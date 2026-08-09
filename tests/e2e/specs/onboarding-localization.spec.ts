import { expect, test } from '@playwright/test'
import { goToLanding, joinRoomByCode, roomCodeOf, seatRows, setLobbySettings, startGameAndReachBaseSelection } from './helpers'

// Coverage: openspec/specs/client-onboarding/spec.md and openspec/specs/localization/spec.md.
//
// Deliberately fast: onboarding scenarios (1-3) never start a game at all (goToLanding is the whole
// setup), and localization (4-5) uses the smallest drive that still reaches real game content (a
// question prompt and a region name) - per e2e-test-tooling's "smallest game that still reaches it".

const CYRILLIC = /[Ѐ-ӿ]/

test.describe('How to play modal', () => {
  test('opens from the landing screen and covers every game mechanic', async ({ page }) => {
    await goToLanding(page)
    const trigger = page.getByTestId('how-to-play-open')
    await expect(trigger).toBeVisible()
    await trigger.click()

    const dialog = page.getByRole('dialog', { name: 'How to play' })
    await expect(dialog).toBeVisible()

    // 11 sections: objective, setup, category ban, base selection, land grab, battle turns, duels,
    // base assault, streaks, golden question, scoring - see client-onboarding's "every mechanic is
    // covered" scenario.
    const headings = await dialog.locator('.how-to-play-phases h3').allTextContents()
    expect(headings).toHaveLength(11)
    const joined = headings.join(' | ').toLowerCase()
    expect(joined).toContain('objective')
    expect(joined).toContain('setup')
    expect(joined).toContain('category') // category-ban draft
    expect(joined).toContain('base') // base selection
    expect(joined).toContain('land grab')
    expect(joined).toContain('battle')
    expect(joined).toContain('duel')
    expect(joined).toContain('capital') // base assault
    expect(joined).toContain('streak')
    expect(joined).toContain('golden')
    expect(joined).toContain('scoring')

    // The base-assault section spans two paragraphs (the assault itself, then self-heal) - assert
    // the modal actually renders both rather than just the first.
    const bodyParagraphs = await dialog.locator('.how-to-play-phases section').nth(7).locator('p').count()
    expect(bodyParagraphs).toBe(2)
  })

  test('closes via its close control and via Escape, returning focus to the trigger each time', async ({ page }) => {
    await goToLanding(page)
    const trigger = page.getByTestId('how-to-play-open')
    const dialog = page.getByRole('dialog', { name: 'How to play' })

    await trigger.click()
    await expect(dialog).toBeVisible()
    await page.getByTestId('how-to-play-close').click()
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()

    await trigger.click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('Tab and Shift+Tab never move focus outside the modal while it is open', async ({ page }) => {
    await goToLanding(page)
    await page.getByTestId('how-to-play-open').click()

    // useModalFocusTrap moves focus onto the first focusable element the instant the modal opens -
    // today that's the close button, the dialog's only focusable control. Repeated Tab/Shift+Tab must
    // keep landing back on it (the trap's own wrap-around), never escaping to the landing screen
    // underneath (e.g. the display-name input or a landing button).
    const closeButton = page.getByTestId('how-to-play-close')
    await expect(closeButton).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(closeButton).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(closeButton).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(closeButton).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(closeButton).toBeFocused()
  })
})

test.describe('room language', () => {
  test('the landing language toggle switches chrome to Russian, and a room created in Russian serves Russian question prompts and region names', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await goToLanding(page) // pins English first, so switching to Russian below is an observable change
    await page.getByTestId('language-ru').click()
    await expect(page.getByTestId('language-ru')).toHaveAttribute('aria-pressed', 'true')

    const chromeText = await page.getByTestId('how-to-play-open').textContent()
    expect(chromeText).toMatch(CYRILLIC)

    await page.getByTestId('display-name').fill('Ada')
    await page.getByTestId('create-room').click()
    await expect(page.getByTestId('seat-0')).toBeVisible()

    // Fill the second seat with a bot (locale-agnostic: an open seat row renders exactly one button,
    // the toggle - its label text is itself Russian right now, so this deliberately doesn't select by
    // role name) to reach a startable two-seat room with only one real page.
    await seatRows(page).nth(1).locator('button').click()
    await expect(seatRows(page).nth(1).locator('.seat-name')).not.toHaveText('')

    // Category ban is this room's only other host setting relevant to reaching base selection -
    // pinned off since this test has nothing to do with it.
    await setLobbySettings(page, { categoryBanDraft: false })
    await startGameAndReachBaseSelection([page])

    const regionName = await page.locator('.region-name').first().textContent()
    expect(regionName).toMatch(CYRILLIC)

    const region = page.locator('g.region.selectable').first()
    await expect(region).toBeVisible({ timeout: 20_000 })
    await region.click()

    await expect(page.getByTestId('question-card')).toBeVisible({ timeout: 30_000 })
    const promptText = await page.getByTestId('question-card').locator('.question-text').textContent()
    expect(promptText).toMatch(CYRILLIC)
  })

  test("the language chosen at creation is fixed for the room: a joiner sees the room's language, not their own chrome preference", async ({
    page,
    context,
  }) => {
    test.setTimeout(90_000)
    await goToLanding(page)
    await page.getByTestId('language-ru').click()
    await page.getByTestId('display-name').fill('Ada')
    await page.getByTestId('create-room').click()
    const code = await roomCodeOf(page)

    // Bob's own chrome preference is left at English (goToLanding's own pin, never toggled) - only
    // the room he's about to join is Russian.
    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    // Joining an existing room applies that room's language to this page's own chrome too (see
    // App.tsx's `applyRoomLanguage` effect keyed off the projected view's language) - spot-check via
    // the whole lobby screen's rendered text rather than one specific string/testid, since Bob (a
    // non-host) doesn't see every host-only control this file otherwise relies on.
    const lobbyText = await page2.locator('body').innerText()
    expect(lobbyText).toMatch(CYRILLIC)

    await setLobbySettings(page, { categoryBanDraft: false })
    await startGameAndReachBaseSelection([page, page2])

    const adaBase = page.locator('g.region.selectable').first()
    await expect(adaBase).toBeVisible({ timeout: 20_000 })
    await adaBase.click()

    await expect(page2.locator('.turn-banner')).toBeVisible({ timeout: 20_000 })
    const bobBase = page2.locator('g.region.selectable').first()
    await expect(bobBase).toBeVisible({ timeout: 20_000 })
    await bobBase.click()

    // The proof this scenario is actually about: Bob himself, who never touched the language toggle,
    // still gets Russian question content and region names because the room's language governs it.
    await expect(page2.getByTestId('question-card')).toBeVisible({ timeout: 30_000 })
    const promptText = await page2.getByTestId('question-card').locator('.question-text').textContent()
    expect(promptText).toMatch(CYRILLIC)

    const regionName = await page2.locator('.region-name').first().textContent()
    expect(regionName).toMatch(CYRILLIC)
  })
})
