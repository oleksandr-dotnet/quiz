import { expect, test, type Page } from '@playwright/test'
import { createRoom, joinRoomByCode, roomCodeOf, seatRows } from './helpers'

// No base-selection/land-grab E2E harness existed before this spec (only room-lobby.spec.ts did).
// This file builds the minimal one it needs: two human seats plus two bot seats, driven into
// LandGrab's very first Question (a 12-20s window shared by every participant, not a tight
// per-player deadline) - the safest, least timing-sensitive point at which to exercise a mid-game
// kick, since both territory dispositions can be triggered and observed without racing a clock.
//
// i18n/index.ts defaults to Russian (fallbackLng: 'ru') unless localStorage already holds an 'en'
// preference - unlike room-lobby.spec.ts's assumption, a fresh context has no such preference, so
// every page here seeds it explicitly before its first navigation to get deterministic English text.
async function forceEnglishLocale(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('triviador.locale', 'en'))
}

/** Clicks the first eligible (highlighted) region during a base pick and returns its region id. */
async function pickFirstEligibleRegion(page: Page): Promise<string> {
  const region = page.locator('g.region.selectable').first()
  const testId = await region.getAttribute('data-testid')
  await region.click()
  return testId!.replace('region-', '')
}

/** Answers whatever question is currently showing, if any - value doesn't matter, just unblocks resolution. */
async function answerQuestionIfAsked(page: Page): Promise<void> {
  const option0 = page.getByTestId('option-0')
  if (await option0.isVisible().catch(() => false)) {
    await option0.click()
    return
  }
  const tipInput = page.getByTestId('tip-input')
  if (await tipInput.isVisible().catch(() => false)) {
    await tipInput.fill('0')
    // The on-screen numeric keypad (including its own submit button) is a touch-only affordance -
    // App.css hides `.numeric-keypad` above 901px width, where this suite's desktop viewport
    // expects Enter to submit instead (QuestionCard's onKeyDown handler).
    await tipInput.press('Enter')
  }
}

async function openKickMenuFor(page: Page, seatIndex: number) {
  await page.getByTestId(`player-card-${seatIndex}`).click()
  await expect(page.getByTestId('player-action-menu')).toBeVisible()
  await page.getByTestId('player-action-kick').click()
}

async function setupToLandGrabWithBobSeated(page: Page, context: import('@playwright/test').BrowserContext) {
  await forceEnglishLocale(page)
  await createRoom(page, 'Ada')
  const code = await roomCodeOf(page)

  const page2 = await context.newPage()
  await forceEnglishLocale(page2)
  await joinRoomByCode(page2, code, 'Bob')
  await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

  await seatRows(page).nth(2).getByRole('button', { name: 'Fill with bot' }).click()
  await seatRows(page).nth(3).getByRole('button', { name: 'Fill with bot' }).click()

  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('base-selection-dock')).toBeVisible()
  await expect(page2.getByTestId('base-selection-dock')).toBeVisible()

  // Ada then Bob pick their own bases via direct UI action - no reliance on either human's personal
  // 15s pick timeout. The two bot seats pick their own bases independently in the background.
  await pickFirstEligibleRegion(page)
  await expect(page2.locator('.turn-banner')).toHaveText(
    'Your turn - click a highlighted territory to claim it as your base',
  )
  const bobBaseRegionId = await pickFirstEligibleRegion(page2)

  await expect(page.getByTestId('land-grab-dock')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('question-card')).toBeVisible()

  return { page2, bobBaseRegionId }
}

test.describe('host kicks a player', () => {
  test.setTimeout(90_000)

  test('kicking in the lobby frees the seat and the old token cannot reclaim it', async ({ page, context }) => {
    await forceEnglishLocale(page)
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await forceEnglishLocale(page2)
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    await page.getByTestId('kick-seat-1').click()
    await expect(page.getByTestId('kick-confirm')).toBeVisible()
    await page.getByTestId('kick-confirm').click()

    await expect(page2.getByTestId('kicked-badge')).toBeVisible()
    await expect(page2.getByTestId('kicked-badge')).toHaveText('You were kicked from the room by the host.')
    await expect(seatRows(page).nth(1).locator('.seat-name')).toHaveText('Open')

    // The freed seat is genuinely open to someone new - proof the old occupant has no residual claim.
    const page3 = await context.newPage()
    await forceEnglishLocale(page3)
    await joinRoomByCode(page3, code, 'Casper')
    await expect(seatRows(page3).nth(1).locator('.seat-name')).toBeVisible()
    await expect(seatRows(page).nth(1).locator('.seat-name')).toHaveText('Casper')
  })

  test('kicking mid-game with bot takeover keeps the game moving through that seat', async ({ page, context }) => {
    const { page2 } = await setupToLandGrabWithBobSeated(page, context)

    await openKickMenuFor(page, 1)
    await expect(page.getByTestId('kick-bot-takeover')).toBeVisible()
    await page.getByTestId('kick-bot-takeover').click()

    await expect(page2.getByTestId('kicked-badge')).toBeVisible()
    await expect(page2.getByTestId('kicked-badge')).toHaveText('You were kicked from the room by the host.')

    // Bob's seat is bot-controlled the instant the kick lands, so it answers the already-pending
    // land-grab question on its own; Ada answering hers is all that's left to unblock resolution.
    await answerQuestionIfAsked(page)
    await expect(page.locator('.turn-banner')).toBeVisible({ timeout: 20_000 })

    // Bob's seat is still an active participant (score/turns), just bot-controlled now - never
    // marked eliminated or withdrawn, matching player-leave-and-takeover's existing guarantees.
    const bobCard = page.getByTestId('player-card-1')
    await expect(bobCard).not.toHaveClass(/eliminated/)
    await expect(bobCard).not.toHaveClass(/withdrawn/)
  })

  test('kicking mid-game with territory release removes the player without granting them anything further', async ({
    page,
    context,
  }) => {
    const { page2, bobBaseRegionId } = await setupToLandGrabWithBobSeated(page, context)

    await openKickMenuFor(page, 1)
    await expect(page.getByTestId('kick-release-land')).toBeVisible()
    await page.getByTestId('kick-release-land').click()

    await expect(page2.getByTestId('kicked-badge')).toBeVisible()
    await expect(page2.getByTestId('kicked-badge')).toHaveText('You were kicked from the room by the host.')

    // Bob's base region is released to neutral immediately - its owner claim-wash disappears.
    await expect(page.getByTestId(`region-${bobBaseRegionId}`).locator('.region-claim-wash')).toHaveCount(0)

    await answerQuestionIfAsked(page)

    // Nobody ever answers on Bob's behalf under this policy, so the already-pending question can
    // only resolve once its own deadline elapses (per design: a withdrawn participant is left to the
    // existing timeout fallback, not specially rerouted) - a bounded, generous wait, not a race.
    await expect(page.locator('.turn-banner')).toBeVisible({ timeout: 25_000 })

    const bobCard = page.getByTestId('player-card-1')
    await expect(bobCard).toContainText('kicked')
    await expect(bobCard).not.toContainText('fallen')
    await expect(bobCard).not.toHaveClass(/eliminated/)
  })
})
