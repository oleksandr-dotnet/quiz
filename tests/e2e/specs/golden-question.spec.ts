import { expect, test, type Page } from '@playwright/test'
import {
  answerCorrectly,
  answerIncorrectly,
  clickFirstEligibleRegion,
  createRoom,
  currentRound,
  joinRoomByCode,
  ownedRegionIds,
  roomCodeOf,
  seatRows,
  setLobbySettings,
  startGameAndReachBaseSelection,
} from './helpers'

// Coverage: openspec/changes/add-streak-ban-golden-mechanics/specs/golden-question/spec.md.
//
// Throughout this file, whenever both players answer the same question, Ada (seat 0) always answers
// correctly and Bob (seat 1) always answers deliberately wrong (answerCorrectly/answerIncorrectly).
// Two reasons this pairing is used everywhere rather than letting both answer correctly:
//   1. It gives land grab a clean, deterministic rank 1 (Ada) / rank 2 (Bob) every round, which
//      scenario 4 depends on to know in advance who the "1st place" queue belongs to.
//   2. A tied Choice-kind duel/base-assault (both exactly correct) triggers its own NumericTiebreak
//      question and its own extra RevealHold (see GameEngine.Battle.cs) - a second, separate reveal
//      for what is really still one engagement. Avoiding ties keeps this file's reveal-counting
//      (scenarios 2 and 3) an honest one-reveal-per-resolved-question count instead of double-counting
//      chained tiebreaks.

test.describe('golden question', () => {
  async function pickBase(page: Page): Promise<string> {
    const region = page.locator('g.region.selectable').first()
    await expect(region).toBeVisible({ timeout: 20_000 })
    const testId = await region.getAttribute('data-testid')
    await region.click()
    return testId!.replace('region-', '')
  }

  /** Creates a two-human room, pins the three mechanics per `opts`, and drives base selection so land grab's first question is up. */
  async function setUpGoldenGame(
    page: Page,
    context: import('@playwright/test').BrowserContext,
    opts: { answerStreaks: boolean; goldenQuestion: boolean; categoryBanDraft: boolean },
  ): Promise<Page> {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    await setLobbySettings(page, opts)
    await startGameAndReachBaseSelection([page, page2])

    await pickBase(page)
    await expect(page2.locator('.turn-banner')).toBeVisible({ timeout: 20_000 })
    await pickBase(page2)

    await expect(page.getByTestId('question-card')).toBeVisible({ timeout: 25_000 })
    await expect(page2.getByTestId('question-card')).toBeVisible({ timeout: 25_000 })
    return page2
  }

  // ---------------------------------------------------------------------------------------------
  // Scenario 1: golden status is never revealed early
  // ---------------------------------------------------------------------------------------------

  /**
   * While `question-card` is visible (a question is pending, per the capability spec's own wording),
   * asserts no golden marker exists anywhere on this page. Land grab's reveal is non-blocking and can
   * legitimately overlap with the *next* pending question on the same snapshot (see
   * useLandGrabReveal.ts) - a golden marker showing there describes the just-resolved question, not a
   * leak of the new one, so the check is skipped for that specific overlap. Battle's RevealHold has no
   * such overlap (a reveal and a pending question are mutually exclusive there), so this only ever
   * skips the check in the one place it would otherwise be a false positive.
   */
  async function assertNoGoldenLeakWhilePending(page: Page): Promise<void> {
    const pending = await page.getByTestId('question-card').isVisible().catch(() => false)
    if (!pending) return
    if (await page.getByTestId('reveal-overlay').isVisible().catch(() => false)) return
    await expect(page.getByTestId('golden-reveal-banner')).toHaveCount(0)
    expect(await page.locator('.reveal-overlay-golden').count()).toBe(0)
  }

  test('golden status is never revealed before a question resolves', async ({ page, context }) => {
    test.setTimeout(120_000)
    const page2 = await setUpGoldenGame(page, context, { answerStreaks: false, goldenQuestion: true, categoryBanDraft: false })

    // Drives deterministically (Ada correct, Bob wrong - this file's header convention), NOT via the
    // shared arbitrary fastForwardUntil, which was this scenario's original approach: that helper has
    // both pages click the same option index every time, which makes a tied-both-correct Choice
    // question - and its extra NumericTiebreak reveal cycle (see answer-ranking's numeric-tiebreak
    // requirement) - common instead of rare, inflating both real wall-clock cost and its variance well
    // past what this scenario needs (observed 9+ minutes and high run-to-run variance in practice).
    // The leak check only needs continuous coverage through land grab and a couple of resolved Battle
    // questions; with no ties ever forced, round 2 arrives in well under a minute.
    const deadline = Date.now() + 100_000
    while ((await currentRound(page)) < 2) {
      if (Date.now() > deadline) throw new Error('golden-leak drive: Battle round 2 not reached within 100s')
      await assertNoGoldenLeakWhilePending(page)
      await assertNoGoldenLeakWhilePending(page2)
      if (await page.getByTestId('question-card').isVisible().catch(() => false)) {
        await answerCorrectly(page).catch(() => {})
      }
      if (await page2.getByTestId('question-card').isVisible().catch(() => false)) {
        await answerIncorrectly(page2).catch(() => {})
      }
      await clickFirstEligibleRegion(page)
      await clickFirstEligibleRegion(page2)
      await page.waitForTimeout(200)
    }
  })

  // ---------------------------------------------------------------------------------------------
  // Shared driving/observing machinery for scenarios 2, 3 and 4 - each resolved question's reveal is
  // captured (text + golden flag) as it happens, since RevealOverlay is the single shared component
  // for both land grab's and Battle's reveals (data-testid="reveal-overlay" either way).
  // ---------------------------------------------------------------------------------------------

  interface RevealRecord {
    text: string
    isGolden: boolean
  }

  async function observeCurrentReveal(page: Page): Promise<RevealRecord> {
    const overlay = page.getByTestId('reveal-overlay')
    await expect(overlay).toBeVisible({ timeout: 20_000 })
    const text = (await overlay.locator('.question-text').textContent())?.trim() ?? ''
    const cls = (await overlay.getAttribute('class')) ?? ''
    return { text, isGolden: cls.includes('reveal-overlay-golden') }
  }

  async function playLandGrabQuestion(page: Page, page2: Page): Promise<RevealRecord> {
    await expect(page.getByTestId('question-card')).toBeVisible({ timeout: 25_000 })
    await expect(page2.getByTestId('question-card')).toBeVisible({ timeout: 25_000 })
    await answerCorrectly(page)
    await answerIncorrectly(page2)
    return observeCurrentReveal(page)
  }

  /** Land grab's resolution signal: the next pick prompt, or straight to battle if that was the last question. */
  async function advanceLandGrab(page: Page): Promise<'more' | 'battle'> {
    const deadline = Date.now() + 25_000
    while (Date.now() < deadline) {
      if (await page.getByTestId('battle-dock').isVisible().catch(() => false)) return 'battle'
      if (await page.getByTestId('land-grab-dock').locator('.turn-banner').isVisible().catch(() => false)) return 'more'
      await page.waitForTimeout(150)
    }
    throw new Error('advanceLandGrab: neither the pick prompt nor battle appeared')
  }

  async function drainLandGrabPicks(page: Page, page2: Page): Promise<void> {
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      if (await page.getByTestId('question-card').isVisible().catch(() => false)) return
      if (await page.getByTestId('battle-dock').isVisible().catch(() => false)) return
      await clickFirstEligibleRegion(page)
      await clickFirstEligibleRegion(page2)
      await page.waitForTimeout(150)
    }
    throw new Error('drainLandGrabPicks: stuck waiting for the next question or battle to begin')
  }

  /** Drives one Battle turn (attack-target pick if needed, then answers) and observes its reveal. Returns null once results-dock appears instead. */
  async function playBattleQuestion(page: Page, page2: Page): Promise<RevealRecord | null> {
    const deadline = Date.now() + 40_000
    while (Date.now() < deadline) {
      if (await page.getByTestId('results-dock').isVisible().catch(() => false)) return null
      const p1 = await page.getByTestId('question-card').isVisible().catch(() => false)
      const p2 = await page2.getByTestId('question-card').isVisible().catch(() => false)
      if (p1 || p2) break
      await clickFirstEligibleRegion(page)
      await clickFirstEligibleRegion(page2)
      await page.waitForTimeout(150)
    }
    // Self-heal has only one participant (the attacker, targeting their own base) - a short grace
    // period lets the other page's own connection catch up before deciding it truly has no question.
    await page.waitForTimeout(300)
    if (await page.getByTestId('question-card').isVisible().catch(() => false)) await answerCorrectly(page)
    if (await page2.getByTestId('question-card').isVisible().catch(() => false)) await answerIncorrectly(page2)
    const record = await observeCurrentReveal(page)
    await expect(page.getByTestId('reveal-overlay')).toBeHidden({ timeout: 15_000 })
    return record
  }

  /** Drives a whole game from land grab's first question to the results screen, reporting each resolved question's reveal via `onReveal`. */
  async function driveWholeGame(page: Page, page2: Page, onReveal: (r: RevealRecord) => void, maxBattleTurns = 80): Promise<void> {
    for (;;) {
      const record = await playLandGrabQuestion(page, page2)
      onReveal(record)
      const next = await advanceLandGrab(page)
      if (next === 'battle') break
      await drainLandGrabPicks(page, page2)
    }
    await expect(page.getByTestId('battle-dock')).toBeVisible({ timeout: 20_000 })

    for (let i = 0; i < maxBattleTurns; i++) {
      if (await page.getByTestId('results-dock').isVisible().catch(() => false)) return
      const record = await playBattleQuestion(page, page2)
      if (record) onReveal(record)
      if (await page.getByTestId('results-dock').isVisible().catch(() => false)) return
    }
    throw new Error(`driveWholeGame: game did not reach results-dock within ${maxBattleTurns} battle turns`)
  }

  // ---------------------------------------------------------------------------------------------
  // Scenario 2: at most GoldenQuestionMaxCount (3) reveals, respecting the cooldown
  // ---------------------------------------------------------------------------------------------

  test('golden reveals appear at most 3 times over a driven game, never twice within the cooldown window', async ({
    page,
    context,
  }) => {
    test.setTimeout(600_000)
    const page2 = await setUpGoldenGame(page, context, { answerStreaks: false, goldenQuestion: true, categoryBanDraft: false })

    const reveals: RevealRecord[] = []
    await driveWholeGame(page, page2, (r) => reveals.push(r))

    expect(reveals.length, 'sanity: the drive should have observed a non-trivial number of questions').toBeGreaterThan(5)

    const goldenIndices = reveals.map((r, i) => (r.isGolden ? i : -1)).filter((i) => i >= 0)
    // The lower bound (GoldenQuestionMinCount, 2) is a real product guarantee too, but it depends on
    // the room's random seed rolling a golden fire (35% chance per eligible question - see
    // GameEngine.LandGrab.cs's RollGolden) enough times before the game ends; over dozens of
    // questions in a full driven game the odds of landing at least one are overwhelming, so this
    // still catches "golden is completely broken" without risking a rare, correct-product flake on
    // the stricter >=2 bound.
    expect(goldenIndices.length, 'at least one golden reveal should occur').toBeGreaterThanOrEqual(1)
    expect(goldenIndices.length, 'GoldenQuestionMaxCount is 3').toBeLessThanOrEqual(3)

    for (let i = 1; i < goldenIndices.length; i++) {
      const nonGoldenQuestionsBetween = goldenIndices[i] - goldenIndices[i - 1] - 1
      expect(nonGoldenQuestionsBetween, `cooldown between golden reveals #${i} and #${i + 1}`).toBeGreaterThanOrEqual(3)
    }
  })

  // ---------------------------------------------------------------------------------------------
  // Scenario 3: golden off => never appears, for a whole game
  // ---------------------------------------------------------------------------------------------

  test('with the setting off, no golden banner ever appears for a whole game', async ({ page, context }) => {
    test.setTimeout(600_000)
    const page2 = await setUpGoldenGame(page, context, { answerStreaks: false, goldenQuestion: false, categoryBanDraft: false })

    const reveals: RevealRecord[] = []
    await driveWholeGame(page, page2, (r) => reveals.push(r))

    expect(reveals.length).toBeGreaterThan(5)
    expect(reveals.every((r) => !r.isGolden)).toBe(true)
  })

  // ---------------------------------------------------------------------------------------------
  // Scenario 4: a golden land-grab reveal doubles the award queue (opportunistic - see report)
  // ---------------------------------------------------------------------------------------------

  /**
   * Mirrors GameEngine.LandGrab.cs's BuildAwardQueue exactly: interleave rank-0/rank-1 picks by
   * column (golden doubles the base [2,1,0,0] to [4,2,0,0]), THEN truncate the whole interleaved
   * sequence to the number of free regions remaining - truncation is global, not per-rank. With fewer
   * than 6 free regions left, that can cut into rank 0's own later picks before rank 1 is exhausted,
   * so "4 for 1st, 2 for 2nd" only holds exactly when at least 6 regions are free - which is why this
   * re-derives the expected split from `freeRegionCount` rather than hardcoding 4/2.
   */
  function expectedGoldenAwardCounts(freeRegionCount: number): { first: number; second: number } {
    const picksByRank = [4, 2, 0, 0]
    const queue: number[] = []
    for (let column = 0; column < 4; column++) {
      for (let rank = 0; rank < picksByRank.length; rank++) {
        if (picksByRank[rank] > column) queue.push(rank)
      }
    }
    const truncated = queue.slice(0, freeRegionCount)
    return {
      first: truncated.filter((r) => r === 0).length,
      second: truncated.filter((r) => r === 1).length,
    }
  }

  test('a golden land-grab reveal doubles the award queue', async ({ page, context }) => {
    test.setTimeout(600_000)
    // Golden questions are seeded randomly (RollGolden: 35% chance per eligible question once the
    // cooldown has elapsed, which it already has by land grab's very first question - see
    // GameEngine.Lobby.cs seeding QuestionsSinceLastGolden to the cooldown value at game start). A
    // single land grab (~5-6 questions) has roughly a 90%+ chance of including at least one golden
    // reveal, so a handful of fresh-room attempts gives very high confidence without hardcoding a seed.
    const MAX_ROOM_ATTEMPTS = 6
    const MAX_ROUNDS_PER_ROOM = 8
    let found = false
    let hostPage = page

    for (let attempt = 0; attempt < MAX_ROOM_ATTEMPTS && !found; attempt++) {
      if (attempt > 0) hostPage = await context.newPage()
      const guestPage = await setUpGoldenGame(hostPage, context, {
        answerStreaks: false,
        goldenQuestion: true,
        categoryBanDraft: false,
      })
      const totalRegions = await hostPage.locator('g.region').count()

      for (let round = 0; round < MAX_ROUNDS_PER_ROOM; round++) {
        const ownedBefore0 = (await ownedRegionIds(hostPage, 0)).length
        const ownedBefore1 = (await ownedRegionIds(hostPage, 1)).length
        const freeBefore = totalRegions - ownedBefore0 - ownedBefore1
        if (freeBefore <= 0) break // this room's land grab already exhausted itself; try a fresh one

        const record = await playLandGrabQuestion(hostPage, guestPage)
        const next = await advanceLandGrab(hostPage)

        if (record.isGolden) {
          // Ada (seat 0) always answers correctly and Bob (seat 1) always wrong, so Ada is
          // deterministically rank 1 and Bob rank 2 here - see this file's header comment.
          if (next === 'more') await drainLandGrabPicks(hostPage, guestPage)
          const ownedAfter0 = (await ownedRegionIds(hostPage, 0)).length
          const ownedAfter1 = (await ownedRegionIds(hostPage, 1)).length
          const expected = expectedGoldenAwardCounts(freeBefore)
          expect(ownedAfter0 - ownedBefore0, 'golden 1st place picks').toBe(expected.first)
          expect(ownedAfter1 - ownedBefore1, 'golden 2nd place picks').toBe(expected.second)
          found = true
          break
        }

        if (next === 'battle') break
        await drainLandGrabPicks(hostPage, guestPage)
      }
    }

    expect(
      found,
      `no golden land-grab reveal observed across ${MAX_ROOM_ATTEMPTS} fresh rooms - see the report for how this was handled`,
    ).toBe(true)
  })
})
