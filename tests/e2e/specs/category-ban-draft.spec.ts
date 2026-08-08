import { expect, test, type Page } from '@playwright/test'
import {
  answerAnyIfAsked,
  clickFirstEligibleRegion,
  createRoom,
  joinRoomByCode,
  roomCodeOf,
  seatRows,
  setLobbySettings,
} from './helpers'
import { categoryOfPrompt } from './question-bank'

// Coverage: openspec/changes/add-streak-ban-golden-mechanics/specs/category-ban-draft/spec.md.
// Every scenario here uses a two-human, no-bot room (category-ban-draft's resolution only depends
// on active-player proposals, and a bot seat's own proposal/timeout would resolve server-side on a
// schedule this file doesn't control, muddying the timing-sensitive scenarios). GameRules.
// CategoryBanProposalDurationSeconds is 20 - scenario 6 alone burns that, so this file's tests carry
// generous explicit timeouts rather than the Playwright default.

/**
 * Creates a two-human room, pins categoryBanDraft on (explicit, even though it's the shipped
 * default - see openspec/.../category-ban-draft/spec.md - so this file keeps passing if that
 * default ever changes) and the other two mechanics off (deterministic scoring isn't this file's
 * concern, but leaving them on would perturb unrelated state for no reason), starts the game, and
 * leaves both pages sitting on the category-ban card. Returns the second (joiner) page; the caller
 * already has the first (host) page.
 */
async function openCategoryBanRoom(page: Page, context: import('@playwright/test').BrowserContext): Promise<Page> {
  await createRoom(page, 'Ada')
  const code = await roomCodeOf(page)

  const page2 = await context.newPage()
  await joinRoomByCode(page2, code, 'Bob')
  await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

  await setLobbySettings(page, { categoryBanDraft: true, answerStreaks: false, goldenQuestion: false })

  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('category-ban-card')).toBeVisible()
  await expect(page2.getByTestId('category-ban-card')).toBeVisible()

  return page2
}

/** Clicks each named category's chip, in order, on this page's still-open ban card. */
async function pickCategories(page: Page, categoryIds: readonly string[]): Promise<void> {
  for (const categoryId of categoryIds) {
    await page.getByTestId(`category-chip-${categoryId}`).click()
  }
}

/**
 * Reads the resolved banned-category ids straight off the persistent top-bar badge
 * (`App.tsx`'s `.banned-categories-badge`), whose aria-label interpolates
 * `view.bannedCategories.join(', ')` verbatim - i.e. the *raw* category ids, not their translated
 * display names, which is exactly what's needed to cross-check against `categoryOfPrompt`'s ids
 * (both are the question bank's own file-basename ids) without hand-maintaining an id->display-name
 * table in this file. Visible on every phase from the moment the draft resolves onward.
 */
async function resolvedBannedCategoryIds(page: Page): Promise<string[]> {
  const badge = page.locator('.banned-categories-badge')
  await expect(badge).toBeVisible({ timeout: 15_000 })
  const label = (await badge.getAttribute('aria-label')) ?? ''
  const match = label.match(/:\s*(.+)$/)
  if (!match) {
    throw new Error(`Could not parse banned-categories badge label: "${label}"`)
  }
  return match[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

test.describe('category ban draft: proposing and resolving', () => {
  test.setTimeout(60_000)

  test('both players proposing full 3-category picks resolves the draft, shows the banned set, and proceeds to base selection', async ({
    page,
    context,
  }) => {
    const page2 = await openCategoryBanRoom(page, context)

    await pickCategories(page, ['geography', 'history', 'science'])
    await page.getByTestId('category-ban-submit').click()
    await pickCategories(page2, ['sports', 'technology', 'nature'])
    await page2.getByTestId('category-ban-submit').click()

    const popup = page.getByTestId('category-ban-result-popup')
    await expect(popup).toBeVisible({ timeout: 10_000 })

    // Two active players, one draw each, collisions allowed (category-ban-draft's "two players'
    // draws can collide" scenario) - so the resolved set is 1 or 2 categories, never 0 or more
    // than the player count.
    const bannedIds = await resolvedBannedCategoryIds(page)
    expect(bannedIds.length).toBeGreaterThanOrEqual(1)
    expect(bannedIds.length).toBeLessThanOrEqual(2)
    await expect(popup.locator('li')).toHaveCount(bannedIds.length)

    await expect(page.getByTestId('base-selection-dock')).toBeVisible({ timeout: 15_000 })
    await expect(page2.getByTestId('base-selection-dock')).toBeVisible({ timeout: 15_000 })
  })

  test('the 3-pick cap holds: a 4th chip click does not select it', async ({ page, context }) => {
    await openCategoryBanRoom(page, context)

    const chips = page.locator('[data-testid^="category-chip-"]')
    expect(await chips.count()).toBeGreaterThanOrEqual(4)

    for (let i = 0; i < 4; i++) {
      await chips.nth(i).click()
    }

    await expect(page.locator('.category-chip.selected')).toHaveCount(3)
    // The 4th click specifically was the rejected one - not just "some" 4th chip elsewhere unselected.
    await expect(chips.nth(3)).not.toHaveClass(/selected/)
  })

  test('an explicit empty proposal ("submit none") is accepted and the draft still resolves', async ({ page, context }) => {
    const page2 = await openCategoryBanRoom(page, context)

    await expect(page.getByTestId('category-ban-submit')).toHaveText(/propose none/i)
    await page.getByTestId('category-ban-submit').click()
    await expect(page.getByTestId('category-ban-sealed')).toBeVisible()

    await expect(page2.getByTestId('category-ban-submit')).toHaveText(/propose none/i)
    await page2.getByTestId('category-ban-submit').click()

    await expect(page.getByTestId('base-selection-dock')).toBeVisible({ timeout: 15_000 })
    await expect(page2.getByTestId('base-selection-dock')).toBeVisible({ timeout: 15_000 })

    // An all-empty draft still bans one category per player, drawn from the full canonical set
    // ("an unresponsive player's slot is resolved without a proposal" / "empty proposal draws from
    // the remaining pool") - it is not a no-op draft.
    const bannedIds = await resolvedBannedCategoryIds(page)
    expect(bannedIds.length).toBeGreaterThanOrEqual(1)
  })

  test('a partial proposal of exactly one category is accepted, and that category is guaranteed banned', async ({
    page,
    context,
  }) => {
    const page2 = await openCategoryBanRoom(page, context)

    await pickCategories(page, ['geography'])
    await page.getByTestId('category-ban-submit').click()
    await expect(page.getByTestId('category-ban-sealed')).toBeVisible()

    // Bob's own proposal doesn't matter to this assertion - submit empty just to move the draft along.
    await page2.getByTestId('category-ban-submit').click()

    await expect(page.getByTestId('base-selection-dock')).toBeVisible({ timeout: 15_000 })

    // A single-category proposal has exactly one possible outcome for the random draw
    // (GameEngine.CategoryBan.cs's ResolveCategoryBanDraft: `proposal[_random.NextInt(0,
    // proposal.Length)]` with Length == 1 is always index 0) - so Ada's contribution to the banned
    // set is deterministic even though the draw itself goes through the room's seeded random source.
    const bannedIds = await resolvedBannedCategoryIds(page)
    expect(bannedIds).toContain('geography')
  })
})

test.describe('category ban draft: in-flight privacy', () => {
  test.setTimeout(60_000)

  test("another player's view shows only that a submission happened, never which categories were proposed", async ({
    page,
    context,
  }) => {
    const page2 = await openCategoryBanRoom(page, context)

    const adaPicks = ['geography', 'history', 'science']
    await pickCategories(page, adaPicks)
    await page.getByTestId('category-ban-submit').click()

    // Ada's own card proves a second submission is impossible from the UI: sealed, with no chip
    // grid or submit button left to interact with (CategoryBanScreen.tsx's `alreadyLocked` branch
    // replaces the whole grid+submit block, it doesn't just disable it).
    await expect(page.getByTestId('category-ban-sealed')).toBeVisible()
    await expect(page.getByTestId('category-ban-submit')).toHaveCount(0)
    await expect(page.locator('.category-chip')).toHaveCount(0)

    // Bob's roster reflects that Ada has submitted (the wax-stamp goes from "waiting" to "answered")...
    const adaStamp = page2.locator('.answer-roster .answer-stamp', { hasText: 'Ada' })
    await expect(adaStamp).toHaveClass(/answered/)

    // ...but none of the specific categories Ada picked show as selected on Bob's own card. Bob's
    // card renders Bob's own (still-empty) selection state, never Ada's - the server's
    // PendingCategoryBanView only ever exposes a bool `hasSubmitted` map plus the viewer's own
    // `yourProposal`, never another player's proposed categories.
    for (const categoryId of adaPicks) {
      await expect(page2.getByTestId(`category-chip-${categoryId}`)).not.toHaveClass(/selected/)
    }
    await expect(page2.locator('.category-chip.selected')).toHaveCount(0)

    // Clean up: let Bob submit so the draft resolves now, rather than leaving a still-pending
    // activity for the remainder of this test's 20s deadline window.
    await page2.getByTestId('category-ban-submit').click()
    await expect(page.getByTestId('base-selection-dock')).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('category ban draft: timeout resolution', () => {
  test.setTimeout(60_000)

  test('a player who never submits does not stall the draft - it resolves on its own ~20s deadline', async ({
    page,
    context,
  }) => {
    const page2 = await openCategoryBanRoom(page, context)

    // Ada submits (empty, doesn't matter which); Bob never touches his card at all.
    await page.getByTestId('category-ban-submit').click()

    // Real margin above GameRules.CategoryBanProposalDurationSeconds (20s) so this isn't a race
    // against the exact deadline, without waiting long enough to dominate the run.
    await expect(page.getByTestId('base-selection-dock')).toBeVisible({ timeout: 30_000 })
    await expect(page2.getByTestId('base-selection-dock')).toBeVisible({ timeout: 30_000 })
  })
})

test.describe('category ban draft: banned categories stay banned', () => {
  test.setTimeout(150_000)

  test('driven questions after the draft resolves never come from a banned category', async ({ page, context }) => {
    const page2 = await openCategoryBanRoom(page, context)

    // Six proposed categories across two players, three each and non-overlapping, maximizes the
    // resolved set's coverage (up to 2 distinct bans for a 2-player game) so this test has the best
    // chance of actually exercising the exclusion rather than vacuously passing on an empty set.
    await pickCategories(page, ['geography', 'history', 'science'])
    await page.getByTestId('category-ban-submit').click()
    await pickCategories(page2, ['sports', 'technology', 'nature'])
    await page2.getByTestId('category-ban-submit').click()

    await expect(page.getByTestId('base-selection-dock')).toBeVisible({ timeout: 15_000 })
    const banned = new Set(await resolvedBannedCategoryIds(page))
    expect(banned.size).toBeGreaterThanOrEqual(1)

    // Drives base selection, land grab, and (if reached) early Battle turns with arbitrary
    // picks/answers - clickFirstEligibleRegion covers base picks, land-grab picks, and battle
    // attack-target selection alike - while recording every distinct question prompt encountered
    // along the way and asserting its resolved category (via the sharded question-bank files) is
    // never one of the banned ones. Unresolvable prompts (wrong language, bank drift) are skipped
    // rather than failing the test, per this scenario's own contract.
    const checkedPrompts = new Set<string>()
    const seenPrompts = new Set<string>()
    const targetChecked = 5
    const deadline = Date.now() + 120_000

    while (checkedPrompts.size < targetChecked && Date.now() < deadline) {
      for (const p of [page, page2]) {
        const card = p.getByTestId('question-card')
        if (!(await card.isVisible().catch(() => false))) continue
        const text = ((await card.locator('.question-text').textContent().catch(() => null)) ?? '').trim()
        if (!text || seenPrompts.has(text)) continue
        seenPrompts.add(text)

        const category = categoryOfPrompt(text)
        if (!category) continue
        expect(banned.has(category), `prompt "${text}" resolved to banned category "${category}"`).toBe(false)
        checkedPrompts.add(text)
      }

      await answerAnyIfAsked(page)
      await answerAnyIfAsked(page2)
      await clickFirstEligibleRegion(page)
      await clickFirstEligibleRegion(page2)
      await page.waitForTimeout(150)
    }

    expect(checkedPrompts.size).toBeGreaterThanOrEqual(targetChecked)
  })
})
