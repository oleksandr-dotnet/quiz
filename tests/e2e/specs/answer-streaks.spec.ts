import { expect, test, type Page } from '@playwright/test'
import {
  answerCorrectly,
  answerIncorrectly,
  clickFirstEligibleRegion,
  createRoom,
  joinRoomByCode,
  readScore,
  roomCodeOf,
  seatRows,
  setLobbySettings,
  startGameAndReachBaseSelection,
} from './helpers'

// Coverage: openspec/changes/add-streak-ban-golden-mechanics/specs/answer-streaks/spec.md.
//
// Land grab is the cheapest place to build and break a streak: both players answer every question
// (unlike Battle, where only the attacker/defender of a given turn participate), and correctness for
// streak purposes is evaluated per-player independently of who "wins" the land-grab ranking - see
// GameEngine.LandGrab.cs's ApplyAnswerStreaks, which checks each participant's own AnswerScore
// (Tier 0/Penalty 0 for Choice, best rank for a multi-participant Tip question) rather than only the
// round's outright winner. So one page answering correctly every round via answerCorrectly and the
// other always via answerIncorrectly reliably grows exactly one player's streak by 1 per round and
// pins the other's at 0, regardless of which question kind gets drawn.
//
// Golden is pinned off in every test here (it doubles streak bonuses, which would confound the exact
// bonus-arithmetic assertions) and category-ban is pinned off too (irrelevant to this capability, and
// this file doesn't want to also drive through that phase).

test.describe('answer streaks', () => {
  test.setTimeout(150_000)

  async function pickBase(page: Page): Promise<string> {
    const region = page.locator('g.region.selectable').first()
    await expect(region).toBeVisible({ timeout: 20_000 })
    const testId = await region.getAttribute('data-testid')
    await region.click()
    return testId!.replace('region-', '')
  }

  /** Creates a two-human room, pins the three mechanics per `opts`, and drives base selection so both seats own a base and land grab's first question is up. */
  async function setUpTwoPlayerLandGrab(
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

  /** Streak badge info for a seat, or null if no badge is rendered (PlayerRoster only renders one when answerStreak > 0). */
  async function streakBadgeInfo(page: Page, seat: number): Promise<{ count: number; classes: string[] } | null> {
    const badge = page.getByTestId(`player-card-${seat}`).locator('.streak-badge')
    if (!(await badge.isVisible().catch(() => false))) return null
    const text = (await badge.textContent()) ?? ''
    const classAttr = (await badge.getAttribute('class')) ?? ''
    return { count: Number(text.trim()), classes: classAttr.split(/\s+/).filter(Boolean) }
  }

  /**
   * Waits for land grab's own resolution signal - the next pick prompt's turn-banner, or battle-dock
   * if that question was the last one - rather than polling `question-card` visibility directly.
   * `question-card` alone can't tell "new question" from "old question, now sealed/awaiting the other
   * participant", since QuestionCard stays mounted across that transition; the pick prompt/battle-dock
   * only exist once the server has actually resolved the question, so they're an unambiguous signal.
   */
  async function waitForLandGrabResolution(page: Page, timeoutMs = 25_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (await page.getByTestId('land-grab-dock').locator('.turn-banner').isVisible().catch(() => false)) return
      if (await page.getByTestId('battle-dock').isVisible().catch(() => false)) return
      await page.waitForTimeout(150)
    }
    throw new Error('waitForLandGrabResolution: neither the next pick prompt nor battle appeared in time')
  }

  /** Submits one land-grab round: `ada` controls seat 0's correctness ('skip' submits nothing, to test a timeout), `bob` controls seat 1's. Returns once the round has resolved. */
  async function playLandGrabRound(
    page: Page,
    page2: Page,
    ada: boolean | 'skip',
    bob: boolean | 'skip',
    resolutionTimeoutMs = 25_000,
  ): Promise<void> {
    await expect(page.getByTestId('question-card')).toBeVisible({ timeout: 25_000 })
    await expect(page2.getByTestId('question-card')).toBeVisible({ timeout: 25_000 })
    if (ada !== 'skip') await (ada ? answerCorrectly(page) : answerIncorrectly(page))
    if (bob !== 'skip') await (bob ? answerCorrectly(page2) : answerIncorrectly(page2))
    await waitForLandGrabResolution(page, resolutionTimeoutMs)
  }

  /** Clicks through whatever region-pick queue is currently up until the next question (or battle) appears. Arbitrary picks - this file never asserts territory. */
  async function drainToNextQuestionOrBattle(page: Page, page2: Page): Promise<void> {
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      if (await page.getByTestId('question-card').isVisible().catch(() => false)) return
      if (await page.getByTestId('battle-dock').isVisible().catch(() => false)) return
      await clickFirstEligibleRegion(page)
      await clickFirstEligibleRegion(page2)
      await page.waitForTimeout(200)
    }
    throw new Error('drainToNextQuestionOrBattle: stuck waiting for the next question or battle to begin')
  }

  test('consecutive correct answers grow the badge and cross tiers bronze -> silver', async ({ page, context }) => {
    const page2 = await setUpTwoPlayerLandGrab(page, context, { answerStreaks: true, goldenQuestion: false, categoryBanDraft: false })

    const expectedTierByStreak: Record<number, string> = {
      1: 'streak-bronze',
      2: 'streak-bronze',
      3: 'streak-bronze',
      4: 'streak-silver',
    }
    for (let streak = 1; streak <= 4; streak++) {
      await playLandGrabRound(page, page2, true, false)
      const badge = await streakBadgeInfo(page, 0)
      expect(badge?.count, `streak should read ${streak}`).toBe(streak)
      expect(badge?.classes, `tier at streak ${streak}`).toContain(expectedTierByStreak[streak])
      await drainToNextQuestionOrBattle(page, page2)
    }
  })

  test('a wrong answer resets the badge to nothing', async ({ page, context }) => {
    const page2 = await setUpTwoPlayerLandGrab(page, context, { answerStreaks: true, goldenQuestion: false, categoryBanDraft: false })

    await playLandGrabRound(page, page2, true, false)
    expect((await streakBadgeInfo(page, 0))?.count).toBe(1)
    await drainToNextQuestionOrBattle(page, page2)

    await playLandGrabRound(page, page2, true, false)
    expect((await streakBadgeInfo(page, 0))?.count).toBe(2)
    await drainToNextQuestionOrBattle(page, page2)

    // Bob answers correctly here (not also wrong) so there's no ambiguity: a multi-participant Tip
    // question's streak-correctness is decided by rank (closest wins), not exact match (see
    // ApplyAnswerStreaks in GameEngine.LandGrab.cs) - if both players were wrong by the same amount
    // (as answerIncorrectly always submits the same "correct + 1,000,000" value), the tie-break would
    // decide rank 1 by elapsed answer time, and Ada (who submits first in this helper) could win that
    // tie-break and keep her streak alive despite being "wrong". Bob answering correctly removes any
    // ambiguity: Ada is unambiguously not rank 1 regardless of question kind.
    await playLandGrabRound(page, page2, false, true)
    expect(await streakBadgeInfo(page, 0)).toBeNull()
  })

  test('a timeout resets the streak exactly as a wrong answer does', async ({ page, context }) => {
    const page2 = await setUpTwoPlayerLandGrab(page, context, { answerStreaks: true, goldenQuestion: false, categoryBanDraft: false })

    await playLandGrabRound(page, page2, true, false)
    expect((await streakBadgeInfo(page, 0))?.count).toBe(1)
    await drainToNextQuestionOrBattle(page, page2)

    await playLandGrabRound(page, page2, true, false)
    expect((await streakBadgeInfo(page, 0))?.count).toBe(2)
    await drainToNextQuestionOrBattle(page, page2)

    // Ada submits nothing this round; Bob still answers so the question doesn't stall on both being
    // silent (that would be a *dead round*, a different land-grab mechanic - see land-grab.spec.ts) -
    // it instead resolves once Ada's own deadline elapses (ChoiceQuestionDurationSeconds 12s /
    // TipQuestionDurationSeconds 20s), which the engine scores as a non-submission, identical to a
    // wrong answer for streak purposes.
    await playLandGrabRound(page, page2, 'skip', true, 30_000)
    expect(await streakBadgeInfo(page, 0)).toBeNull()
  })

  test('the answer moving a streak 2 -> 3 adds exactly 100, and the first correct answer of a streak adds 0', async ({
    page,
    context,
  }) => {
    const page2 = await setUpTwoPlayerLandGrab(page, context, { answerStreaks: true, goldenQuestion: false, categoryBanDraft: false })

    // Isolation strategy: a land-grab question's resolution (where the streak bonus lands, in
    // PlayerState.BonusScore) and its territory award (the region-pick queue) are two separate steps -
    // ownership never changes until a PickRegion command is actually sent, which this test never does
    // before reading score. So reading Ada's score right at resolution's own signal (see
    // waitForLandGrabResolution) - before a single region has been clicked - isolates the delta to
    // exactly the streak bonus, with no territory-value movement to confound it. Golden is pinned off
    // too, since it would double the bonus and break the exact-100 assertion.

    const scoreBeforeRound1 = await readScore(page, 0)
    await playLandGrabRound(page, page2, true, false)
    // First correct answer of the game: streak 0 -> 1, bonus is 0 * 50 = 0.
    await expect(page.getByTestId('player-card-0').locator('.score')).toHaveText(String(scoreBeforeRound1), { timeout: 5_000 })
    expect((await streakBadgeInfo(page, 0))?.count).toBe(1)
    await drainToNextQuestionOrBattle(page, page2)

    await playLandGrabRound(page, page2, true, false)
    // streak 1 -> 2, bonus 1 * 50 = 50 - not the assertion under test, just setup for round 3.
    expect((await streakBadgeInfo(page, 0))?.count).toBe(2)
    await drainToNextQuestionOrBattle(page, page2)

    const scoreBeforeRound3 = await readScore(page, 0)
    await playLandGrabRound(page, page2, true, false)
    // The tricky one: streak 2 -> 3, bonus 2 * 50 = 100 exactly.
    await expect(page.getByTestId('player-card-0').locator('.score')).toHaveText(String(scoreBeforeRound3 + 100), {
      timeout: 5_000,
    })
    expect((await streakBadgeInfo(page, 0))?.count).toBe(3)
  })

  test('with the setting off, no badge ever appears and no streak bonus is ever scored', async ({ page, context }) => {
    const page2 = await setUpTwoPlayerLandGrab(page, context, { answerStreaks: false, goldenQuestion: false, categoryBanDraft: false })

    for (let round = 0; round < 3; round++) {
      const scoreBefore = await readScore(page, 0)
      // Still answers correctly every round - if streaks were mistakenly still active despite the
      // setting, this would grow a badge/bonus exactly like the enabled tests above.
      await playLandGrabRound(page, page2, true, false)
      // Same isolation as the arithmetic test: read right at resolution's own signal, before this
      // test drains a single region pick, so any non-zero delta here could only be a leaked streak
      // bonus, never territory.
      await expect(page.getByTestId('player-card-0').locator('.score')).toHaveText(String(scoreBefore), { timeout: 5_000 })
      expect(await streakBadgeInfo(page, 0)).toBeNull()
      expect(await streakBadgeInfo(page, 1)).toBeNull()
      await drainToNextQuestionOrBattle(page, page2)
    }
  })

  test('a streak survives the land-grab -> battle phase transition', async ({ page, context }) => {
    test.setTimeout(240_000)
    const page2 = await setUpTwoPlayerLandGrab(page, context, { answerStreaks: true, goldenQuestion: false, categoryBanDraft: false })

    // Keep Ada correct and Bob wrong for the whole of land grab, so her streak only ever grows - if
    // the phase boundary had a bug that reset it, the badge would read 0 (or 1, if it silently
    // re-derived from something else) right on arrival at battle-dock instead of carrying the count
    // built up through land grab. Bob must answer *wrong*, not also correct: a multi-participant Tip
    // question where both players are exactly correct is a tie, broken by a seeded random shuffle
    // (TieBreakOrder.Shuffled) rather than anything favoring seat 0 - Ada could occasionally lose that
    // coin flip and have her streak not extend that round despite answering correctly.
    // A land-grab question is only ever asked while at least one free region remains to award it (see
    // AdvanceRegionPickQueue in GameEngine.LandGrab.cs), so the *question* resolving never itself
    // completes land grab - only draining that question's own award queue can. That means the
    // battle-dock check has to happen fresh at the top of every iteration (including before the very
    // first one), not as a flag captured before the drain that might cause the transition - capturing
    // it earlier would let the loop run one phantom extra round against whatever happens to be on
    // screen right after Battle has already begun.
    let adaStreak = 0
    for (let round = 0; round < 12; round++) {
      if (await page.getByTestId('battle-dock').isVisible().catch(() => false)) break
      await playLandGrabRound(page, page2, true, false)
      adaStreak += 1
      expect((await streakBadgeInfo(page, 0))?.count).toBe(adaStreak)
      await drainToNextQuestionOrBattle(page, page2)
    }
    await expect(page.getByTestId('battle-dock')).toBeVisible({ timeout: 20_000 })

    // The transition itself must not have touched the streak.
    expect((await streakBadgeInfo(page, 0))?.count).toBe(adaStreak)

    // One Battle turn: whoever's turn it is picks a target - in a two-player game Battle is always a
    // duel between the only two players, so Ada is always a participant regardless of who attacks.
    // She answers correctly and her streak should extend by exactly one more, proving it's the same
    // persistent counter continuing, not a fresh one that happens to already read the right number.
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      if (
        (await page.getByTestId('question-card').isVisible().catch(() => false)) &&
        (await page2.getByTestId('question-card').isVisible().catch(() => false))
      ) {
        break
      }
      await clickFirstEligibleRegion(page)
      await clickFirstEligibleRegion(page2)
      await page.waitForTimeout(200)
    }
    await expect(page.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })
    await expect(page2.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })
    await answerCorrectly(page)
    await answerIncorrectly(page2)
    await expect(page.getByTestId('reveal-overlay')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('reveal-overlay')).toBeHidden({ timeout: 15_000 })

    expect((await streakBadgeInfo(page, 0))?.count).toBe(adaStreak + 1)
  })
})
