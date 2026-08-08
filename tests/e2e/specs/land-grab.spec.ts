import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import {
  answerAnyIfAsked,
  answerCorrectly,
  answerIncorrectly,
  clickFirstEligibleRegion,
  createRoom,
  fastForwardToBattle,
  fastForwardUntil,
  joinRoomByCode,
  ownedRegionIds,
  regionOwnerSeatOf,
  roomCodeOf,
  seatRows,
  setLobbySettings,
  startGameAndReachBaseSelection,
} from './helpers'

// Coverage: openspec/specs/land-grab-flow/spec.md (plan section 2.5). A two-player, no-bot game
// (GameRules.MinPlayers's floor) with all three add-streak-ban-golden-mechanics off - streaks and
// golden would otherwise perturb nothing here (this file never reads score), but category-ban-draft
// defaults ON and would land StartGame in the CategoryBan phase before base selection even begins.

const here = path.dirname(fileURLToPath(import.meta.url))
const mapPath = path.resolve(here, '..', '..', '..', 'src', 'UI', 'Triviador.Web', 'Data', 'map.json')

interface MapRegionJson {
  id: string
  adjacentTo: string[]
}

const mapRegions: MapRegionJson[] = JSON.parse(readFileSync(mapPath, 'utf8')).regions
const directNeighborsOf = new Map(mapRegions.map((r) => [r.id, r.adjacentTo]))

/** Creates a two-human room with all three optional mechanics off, so StartGame goes straight to base selection. */
async function setUpTwoHumanRoom(page: Page, context: BrowserContext): Promise<Page> {
  await createRoom(page, 'Ada')
  const code = await roomCodeOf(page)
  const page2 = await context.newPage()
  await joinRoomByCode(page2, code, 'Bob')
  await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')
  await setLobbySettings(page, { answerStreaks: false, categoryBanDraft: false, goldenQuestion: false })
  return page2
}

/**
 * Fast-forwards through base selection (arbitrary picks - which regions become bases doesn't
 * matter to any scenario that calls this) and stops the instant land grab's first question
 * appears, before either page has answered it. Safe because fastForwardUntil checks its condition
 * before acting on each tick, so a condition that's already true when land grab starts is caught
 * before that same tick's answerAnyIfAsked call could fire.
 */
async function reachFirstLandGrabQuestion(page: Page, page2: Page): Promise<void> {
  await fastForwardUntil(page, page2, () => page.getByTestId('land-grab-dock').isVisible().catch(() => false))
}

/**
 * Clicks whichever page currently has an award-queue pick offered to it, tick by tick, until the
 * combined region count across both seats reaches `startTotal + expectedPicks` - used once the
 * ranking (and hence who picks first) has already been forced deterministically. Driven off the
 * running total rather than "one call == one pick": on a fast local server the round trip for one
 * pick can complete before this tick's second click attempt even fires, so a single tick can
 * legitimately land two consecutive queue picks (e.g. both of the interleaved queue's first two
 * entries) - a caller that instead invoked a per-pick helper a fixed number of times would race
 * the queue draining early and time out waiting for a pick that was never coming.
 */
async function drainAwardQueuePicks(page: Page, page2: Page, expectedPicks: number): Promise<void> {
  const startTotal = (await ownedRegionIds(page, 0)).length + (await ownedRegionIds(page, 1)).length
  const target = startTotal + expectedPicks
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    await clickFirstEligibleRegion(page)
    await clickFirstEligibleRegion(page2)
    const total = (await ownedRegionIds(page, 0)).length + (await ownedRegionIds(page, 1)).length
    if (total >= target) return
    await page.waitForTimeout(200)
  }
  throw new Error('drainAwardQueuePicks: the award queue did not fully drain within 30s')
}

test.describe('land grab', () => {
  test('happy path: the ranked award queue interleaves 2 picks for the winner and 1 for the runner-up', async ({ page, context }) => {
    const page2 = await setUpTwoHumanRoom(page, context)
    await startGameAndReachBaseSelection([page, page2])
    await reachFirstLandGrabQuestion(page, page2)

    const before0 = (await ownedRegionIds(page, 0)).length
    const before1 = (await ownedRegionIds(page, 1)).length
    expect(before0).toBe(1) // just their own base so far
    expect(before1).toBe(1)

    // Correct beats incorrect regardless of elapsed time (AnswerRanker ranks by correctness tier
    // first) - Ada is deterministically rank 1, Bob rank 2.
    await answerCorrectly(page)
    await answerIncorrectly(page2)

    // The interleaved queue is [1st, 2nd, 1st] - three picks total, claimed as soon as each is
    // offered, whichever page currently holds the turn.
    await drainAwardQueuePicks(page, page2, 3)

    await expect.poll(async () => (await ownedRegionIds(page, 0)).length).toBe(before0 + 2)
    await expect.poll(async () => (await ownedRegionIds(page, 1)).length).toBe(before1 + 1)
  })

  test('own submitted answer echoes back as locked-in, and survives a page reload', async ({ page, context }) => {
    const page2 = await setUpTwoHumanRoom(page, context)
    await startGameAndReachBaseSelection([page, page2])
    await reachFirstLandGrabQuestion(page, page2)

    await answerAnyIfAsked(page)
    await expect(page.getByTestId('sealed-plate')).toBeVisible()

    await page.reload()
    await expect(page.getByTestId('sealed-plate')).toBeVisible({ timeout: 10_000 })
  })

  test('tricky: an opponents in-flight answer is never rendered, and no correct answer is visible before resolution', async ({
    page,
    context,
  }) => {
    const page2 = await setUpTwoHumanRoom(page, context)
    await startGameAndReachBaseSelection([page, page2])
    await reachFirstLandGrabQuestion(page, page2)

    // Bob answers; Ada deliberately never does, so the question stays pending and nothing about
    // to resolve it happens on Ada's page.
    await answerAnyIfAsked(page2)

    const bobRow = page.locator('.answer-roster li').filter({ hasText: 'Bob' })
    const adaRow = page.locator('.answer-roster li').filter({ hasText: 'Ada' })
    await expect(bobRow).toHaveClass(/answered/)
    await expect(adaRow).toHaveClass(/waiting/)

    // Ada hasn't answered herself, so she should still see her own live answering UI, not a
    // sealed plate - and nothing on her page should reveal Bob's submitted value or the correct
    // answer this early (PendingQuestionView carries no other participant's answer value at all,
    // and the reveal overlay only exists once QuestionResolved has fired).
    await expect(page.getByTestId('sealed-plate')).toHaveCount(0)
    await expect(page.getByTestId('reveal-overlay')).toHaveCount(0)
    const bobRowText = await bobRow.textContent()
    expect(bobRowText).not.toMatch(/\d/)
  })

  test('a region pick must border owned territory while a bordering free region exists', async ({ page, context }) => {
    const page2 = await setUpTwoHumanRoom(page, context)
    await startGameAndReachBaseSelection([page, page2])

    // Pin both bases so the picker's owned territory (and hence the bordering-only rule) is
    // predictable: r01 and r18 sit at opposite corners of the map, far past MinimumBaseDistance.
    await expect(page.getByTestId('region-r01')).toHaveClass(/selectable/)
    await page.getByTestId('region-r01').click()
    await expect(page2.getByTestId('region-r18')).toHaveClass(/selectable/)
    await page2.getByTestId('region-r18').click()

    await expect(page.getByTestId('land-grab-dock')).toBeVisible()
    await answerCorrectly(page) // Ada ranks 1st, so she is the award queue's first picker
    await answerIncorrectly(page2)

    // Ada owns only r01 right now. r01's map.json neighbors (r02, r07) are free and bordering;
    // r09 is free but borders neither r01 nor anything else Ada owns.
    const [bordering, ...rest] = directNeighborsOf.get('r01') ?? []
    expect(bordering).toBeTruthy()
    const nonBorderingFreeRegion = 'r09'
    expect(directNeighborsOf.get('r01') ?? []).not.toContain(nonBorderingFreeRegion)

    await expect(page.getByTestId(`region-${bordering}`)).toHaveClass(/selectable/)
    await expect(page.getByTestId(`region-${nonBorderingFreeRegion}`)).not.toHaveClass(/selectable/)
    expect(await page.locator(`[data-testid="region-${nonBorderingFreeRegion}"] .marching-ants`).count()).toBe(0)

    // A forced illegal pick is rejected server-side (RegionNotEligible) - ownership and turn are
    // both unaffected.
    await page.getByTestId(`region-${nonBorderingFreeRegion}`).click({ force: true })
    await page.waitForTimeout(500)
    expect(await regionOwnerSeatOf(page, nonBorderingFreeRegion)).toBeNull()
    await expect(page.getByTestId(`region-${bordering}`)).toHaveClass(/selectable/)

    // The legal, bordering pick is accepted.
    await page.getByTestId(`region-${bordering}`).click()
    await expect.poll(() => regionOwnerSeatOf(page, bordering!)).toBe(0)
    void rest
  })

  test('tricky: the picker turn auto-resolves on its own deadline, and the award queue drains without a stall', async ({
    page,
    context,
  }) => {
    test.setTimeout(90_000)
    const page2 = await setUpTwoHumanRoom(page, context)
    await startGameAndReachBaseSelection([page, page2])
    await reachFirstLandGrabQuestion(page, page2)

    await answerCorrectly(page)
    await answerIncorrectly(page2)

    // Deliberately never click a region - GameRules.LandGrabPickDurationSeconds (10s) must
    // auto-resolve each of the queue's 3 picks in turn (TimeoutElapsed -> TimeoutRegionPick),
    // proving the deadline path itself rather than the manual-click path the happy-path test
    // already covers. If the queue ever stalled, this poll would time out.
    await expect
      .poll(async () => (await ownedRegionIds(page, 0)).length + (await ownedRegionIds(page, 1)).length, {
        timeout: 45_000,
        message: 'the award queue should drain via auto-resolved picks without stalling',
      })
      .toBe(5) // 2 bases + 3 awarded picks

    expect((await ownedRegionIds(page, 0)).length).toBe(3) // 1st place: base + 2 awarded picks
    expect((await ownedRegionIds(page, 1)).length).toBe(2) // 2nd place: base + 1 awarded pick
  })

  test('tricky: a fully silent question is a dead round - no territory is awarded and a fresh question follows', async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000)
    const page2 = await setUpTwoHumanRoom(page, context)
    await startGameAndReachBaseSelection([page, page2])
    await reachFirstLandGrabQuestion(page, page2)

    const firstPrompt = ((await page.getByTestId('question-card').locator('.question-text').textContent()) ?? '').trim()
    const before0 = (await ownedRegionIds(page, 0)).length
    const before1 = (await ownedRegionIds(page, 1)).length

    // Neither page answers. GameRules.TipQuestionDurationSeconds (20s, the longer of the two kinds)
    // covers the worst case before the dead-round path (ResolveQuestion's allSilent branch) fires
    // and asks a fresh question to the same participants - no RevealHold, no award queue.
    await expect
      .poll(
        async () => ((await page.getByTestId('question-card').locator('.question-text').textContent()) ?? '').trim(),
        { timeout: 30_000, message: 'a fresh question should be asked after the dead round, with no award queue in between' },
      )
      .not.toBe(firstPrompt)

    expect((await ownedRegionIds(page, 0)).length).toBe(before0)
    expect((await ownedRegionIds(page, 1)).length).toBe(before1)
    // No award queue ever started in between: an award-queue turn is the only thing that renders
    // a .turn-banner inside land-grab-dock, and none exists while a fresh question is up.
    await expect(page.getByTestId('land-grab-dock').locator('.turn-banner')).toHaveCount(0)
  })

  test('land grab ends the instant the last region is claimed, and battle begins immediately', async ({ page, context }) => {
    test.setTimeout(240_000)
    const page2 = await setUpTwoHumanRoom(page, context)
    await startGameAndReachBaseSelection([page, page2])

    await fastForwardToBattle(page, page2)

    await expect(page.getByTestId('battle-dock')).toBeVisible()
    await expect(page2.getByTestId('battle-dock')).toBeVisible()
    await expect(page.getByTestId('land-grab-dock')).toHaveCount(0)

    // Every region on the 18-region map belongs to one of the only two seats in this game.
    const owned0 = await ownedRegionIds(page, 0)
    const owned1 = await ownedRegionIds(page, 1)
    expect(owned0.length + owned1.length).toBe(18)
  })
})
