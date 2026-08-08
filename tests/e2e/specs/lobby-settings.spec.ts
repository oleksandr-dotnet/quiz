import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import {
  createRoom,
  dismissCategoryBanResultIfPresent,
  goToLanding,
  joinRoomByCode,
  passCategoryBanIfPresent,
  roomCodeOf,
  seatRows,
  setLobbySettings,
  startGameAndReachBaseSelection,
} from './helpers'

// Coverage note: exercises plan section 2.2 (host-only game settings: answer streaks, category-ban
// draft, golden question). See tests/e2e/TEST-PLAN.md section 2.2.

/**
 * Fills the 4-cell room-code input by its per-cell aria-label - kept local (helpers.ts's own copy
 * isn't exported) per this file's ownership rules.
 */
async function enterRoomCode(page: Page, code: string): Promise<void> {
  for (let i = 0; i < code.length; i++) {
    await page.getByLabel(`Room code character ${i + 1}`).fill(code[i])
  }
}

/**
 * Walks every page past CategoryBan (submitting an empty proposal and dismissing the result popup)
 * until all reach base-selection-dock - the tail half of helpers.ts's startGameAndReachBaseSelection,
 * minus the initial start-game click, for callers (like the category-ban-on test below) that need to
 * assert something about the CategoryBan phase itself before resolving it.
 */
async function resolveCategoryBanAndReachBaseSelection(pages: readonly Page[]): Promise<void> {
  const deadline = Date.now() + 60_000
  for (;;) {
    let allReady = true
    for (const p of pages) {
      await passCategoryBanIfPresent(p)
      await dismissCategoryBanResultIfPresent(p)
      if (!(await p.getByTestId('base-selection-dock').isVisible().catch(() => false))) {
        allReady = false
      }
    }
    if (allReady) break
    if (Date.now() > deadline) break // let the assertions below produce the real failure message
    await pages[0].waitForTimeout(250)
  }
  for (const p of pages) {
    await expect(p.getByTestId('base-selection-dock')).toBeVisible()
  }
}

test.describe('settings are shared, server-projected state', () => {
  test('the host toggling each setting updates every seated player\'s panel', async ({ page, context }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    // Defaults are all ON - confirm that starting point on Bob's own panel before flipping anything,
    // so the assertion below proves a real change rather than an already-off value staying off.
    await expect(page2.getByTestId('setting-answer-streaks')).toBeChecked()
    await expect(page2.getByTestId('setting-category-ban-draft')).toBeChecked()
    await expect(page2.getByTestId('setting-golden-question')).toBeChecked()

    // Flip all three off from Ada's (host's) page - Bob never touches his own checkboxes, so any
    // change on his panel can only have come from the server projection, not local UI state.
    await setLobbySettings(page, { answerStreaks: false, categoryBanDraft: false, goldenQuestion: false })

    await expect(page2.getByTestId('setting-answer-streaks')).not.toBeChecked()
    await expect(page2.getByTestId('setting-category-ban-draft')).not.toBeChecked()
    await expect(page2.getByTestId('setting-golden-question')).not.toBeChecked()
  })

  test('a non-host sees the three checkboxes disabled and cannot change a value', async ({ page, context }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    const checkbox = page2.getByTestId('setting-answer-streaks')
    await expect(checkbox).toBeDisabled()
    const wasChecked = await checkbox.isChecked()

    // Force the click past Playwright's own actionability check (which would otherwise refuse to
    // click a disabled element) to prove the protection is real at the DOM/server level, not just
    // that this test never tried: a native disabled <input> ignores the click outright, and
    // LobbyScreen's toggleSetting additionally bails out on `!view.youAreHost` before ever calling
    // setGameSettings even if it somehow fired.
    await checkbox.click({ force: true }).catch(() => {})
    await expect(checkbox).toBeChecked({ checked: wasChecked })
  })
})

test.describe('category ban draft gates base selection', () => {
  test('with category ban off, StartGame goes straight to base selection and no ban card ever shows', async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000)
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    await setLobbySettings(page, { categoryBanDraft: false })
    await startGameAndReachBaseSelection([page, page2])

    // GameRules.EnableCategoryBanDraft false means the engine's pump never produces a CategoryBan
    // phase at all - not "shown then skipped fast", genuinely never entered.
    await expect(page.getByTestId('category-ban-card')).toHaveCount(0)
    await expect(page2.getByTestId('category-ban-card')).toHaveCount(0)
  })

  test('with category ban on, the ban card is shown to every active player before base selection', async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000)
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    await setLobbySettings(page, { categoryBanDraft: true })
    await page.getByTestId('start-game').click()

    await expect(page.getByTestId('category-ban-card')).toBeVisible()
    await expect(page2.getByTestId('category-ban-card')).toBeVisible()

    await resolveCategoryBanAndReachBaseSelection([page, page2])
  })
})

test.describe('settings panel lifecycle', () => {
  test('the settings panel is gone once the game has started', async ({ page, context }) => {
    test.setTimeout(60_000)
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')
    await expect(page.getByTestId('game-settings-panel')).toBeVisible()
    await expect(page2.getByTestId('game-settings-panel')).toBeVisible()

    await setLobbySettings(page, { categoryBanDraft: false })
    await startGameAndReachBaseSelection([page, page2])

    await expect(page.getByTestId('game-settings-panel')).toHaveCount(0)
    await expect(page2.getByTestId('game-settings-panel')).toHaveCount(0)
  })
})

test.describe('settings mid-join race', () => {
  test('a joiner mid-join sees the host\'s just-flipped setting on their first render, never a stale default', async ({
    page,
    context,
  }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    // Bob gets as far as the landing screen - name filled, code entered - but hasn't submitted yet.
    const page2 = await context.newPage()
    await goToLanding(page2)
    await page2.getByTestId('display-name').fill('Bob')
    await enterRoomCode(page2, code)

    // Ada flips a setting while Bob is sitting on that unsubmitted form. setLobbySettings waits for
    // the change to settle server-side (RoomActor's single mailbox has fully processed and replied
    // to it) before returning, so Bob's join - submitted only after this resolves - is guaranteed to
    // be processed after the flip, never racing ahead of it.
    await setLobbySettings(page, { goldenQuestion: false })

    await page2.getByTestId('join-room').click()
    await expect(page2.getByTestId('seat-0')).toBeVisible()

    // Bob's very first rendered panel already carries the flip - RoomActor.BuildView reads current
    // settings fields at join time, so there is no defaults-then-corrected flash to catch either.
    await expect(page2.getByTestId('setting-golden-question')).not.toBeChecked()
    await expect(page2.getByTestId('setting-answer-streaks')).toBeChecked()
  })
})
