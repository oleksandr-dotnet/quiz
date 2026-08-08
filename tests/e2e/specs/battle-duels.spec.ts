import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import {
  answerAnyIfAsked,
  answerCorrectly,
  answerIncorrectly,
  clickFirstEligibleRegion,
  currentRound,
  ownedRegionIds,
  readScore,
  regionOwnerSeatOf,
  setUpTwoPlayerBattle,
} from './helpers'

// Coverage: openspec/specs/battle-flow's ordinary-duel requirements ("A duel is decided by one
// question, defender favored on a tie", "An attack target must be an enemy region adjacent to the
// attacker's territory", "A resolved battle question is followed by a reveal before its effects
// apply", "Turns proceed in seat order, one round per full cycle") plus
// openspec/changes/duel-defense-score-bonus's new defender-only score bonus. setUpTwoPlayerBattle
// (per e2e-test-tooling's "smallest game that still reaches it") gets a two-human, no-bot game to
// Battle's first turn with streaks/category-ban/golden pinned off, so every score-delta assertion
// below is exact. Every scenario here plays out well before GameRules.BaseAssaultUnlockRound (8),
// so every attack is guaranteed to be an ordinary duel, never a base assault - that phase belongs to
// battle-base-assault.spec.ts.

interface MapRegionJson {
  id: string
  adjacentTo: string[]
}

/** Region id -> its adjacent region ids, read straight from the same map.json the server serves. */
function loadAdjacency(): Map<string, Set<string>> {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const mapPath = path.resolve(here, '..', '..', '..', 'src', 'UI', 'Triviador.Web', 'Data', 'map.json')
  const parsed = JSON.parse(readFileSync(mapPath, 'utf8')) as { regions: MapRegionJson[] }
  return new Map(parsed.regions.map((r) => [r.id, new Set(r.adjacentTo)]))
}

/** Every region id currently rendered with the `selectable` (eligible-target) class. */
async function selectableRegionIds(page: Page): Promise<string[]> {
  const testIds = await page.locator('g.region.selectable').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')))
  return testIds.filter((id): id is string => id !== null).map((id) => id.replace('region-', ''))
}

interface DuelTurn {
  attacker: Page
  defender: Page
  attackerSeat: number
  defenderSeat: number
}

/**
 * Waits for whichever of the two pages currently has an eligible attack target offered and reports
 * it as the attacker - works regardless of which seat's turn it actually is, since only one page can
 * legitimately show a selectable region at a time. Seats are fixed by join order (setUpTwoPlayerBattle
 * always seats Ada at 0/page, Bob at 1/page2 - see its own doc comment and battle-base-assault-bonus's
 * identical [page, page2, 0, 1] convention).
 */
async function waitForAttackerTurn(page: Page, page2: Page, timeoutMs = 20_000): Promise<DuelTurn> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await page.locator('g.region.selectable').first().isVisible().catch(() => false)) {
      return { attacker: page, defender: page2, attackerSeat: 0, defenderSeat: 1 }
    }
    if (await page2.locator('g.region.selectable').first().isVisible().catch(() => false)) {
      return { attacker: page2, defender: page, attackerSeat: 1, defenderSeat: 0 }
    }
    if (Date.now() > deadline) {
      throw new Error('waitForAttackerTurn: neither page showed a selectable attack target within timeout')
    }
    await page.waitForTimeout(200)
  }
}

test.describe('battle duels', () => {
  test.setTimeout(240_000)

  test('the attacker capturing a duel only transfers the region after the reveal closes', async ({ page, context }) => {
    const page2 = await setUpTwoPlayerBattle(page, context)

    const { attacker, defender, attackerSeat, defenderSeat } = await waitForAttackerTurn(page, page2)
    const regionId = await clickFirstEligibleRegion(attacker)
    expect(regionId, 'expected an eligible attack target on the current attacker page').not.toBeNull()

    await expect(attacker.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })
    await expect(defender.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })
    expect(await regionOwnerSeatOf(attacker, regionId!)).toBe(defenderSeat)

    // Defender deliberately wrong, attacker correct - a decisive attacker win by tier alone, with no
    // chance of the "both correct" numeric-tiebreak path (answer-ranking's numeric-tiebreak
    // requirement only triggers when both combatants score Tier 0).
    await answerIncorrectly(defender)
    await answerCorrectly(attacker)

    await expect(attacker.getByTestId('reveal-overlay')).toBeVisible({ timeout: 10_000 })
    // Still the defender's while the reveal is up - battle-flow's "A resolved battle question is
    // followed by a reveal before its effects apply" requirement.
    expect(await regionOwnerSeatOf(attacker, regionId!)).toBe(defenderSeat)

    await expect(attacker.getByTestId('reveal-overlay')).toBeHidden({ timeout: 15_000 })
    expect(await regionOwnerSeatOf(attacker, regionId!)).toBe(attackerSeat)
  })

  test('the defender winning a duel keeps the region and gains exactly the duel-defense bonus', async ({ page, context }) => {
    const page2 = await setUpTwoPlayerBattle(page, context)

    const { attacker, defender, attackerSeat, defenderSeat } = await waitForAttackerTurn(page, page2)
    const regionId = await clickFirstEligibleRegion(attacker)
    expect(regionId).not.toBeNull()

    await expect(attacker.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })
    await expect(defender.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })

    const attackerScoreBefore = await readScore(attacker, attackerSeat)
    const defenderScoreBefore = await readScore(defender, defenderSeat)

    // Attacker deliberately wrong, defender correct - a decisive defender win, again with no chance
    // of the numeric-tiebreak path.
    await answerIncorrectly(attacker)
    await answerCorrectly(defender)

    await expect(attacker.getByTestId('reveal-overlay')).toBeVisible({ timeout: 10_000 })
    await expect(attacker.getByTestId('reveal-overlay')).toBeHidden({ timeout: 15_000 })

    // Ownership unchanged, and streaks/golden are pinned off, so +200 to the defender and no change
    // to the attacker is the only possible score movement (duel-defense-score-bonus: "Unlike the
    // base-assault score bonus, this is one-sided - the attacker's score SHALL NOT be reduced").
    expect(await regionOwnerSeatOf(attacker, regionId!)).toBe(defenderSeat)
    await expect(attacker.getByTestId(`player-card-${defenderSeat}`).locator('.score')).toHaveText(
      String(defenderScoreBefore + 200),
      { timeout: 10_000 },
    )
    await expect(attacker.getByTestId(`player-card-${attackerSeat}`).locator('.score')).toHaveText(
      String(attackerScoreBefore),
      { timeout: 10_000 },
    )

    // App.tsx's duelDefendedProclamation only fires for the defender - see useGameTransitions.ts's
    // duelDefenseScoreAwarded derivation.
    await expect(defender.getByRole('alert').first()).toContainText('200', { timeout: 5_000 })
  })

  test('a double timeout is a tie the defender-favored tie-break wins, and still pays the defense bonus', async ({
    page,
    context,
  }) => {
    const page2 = await setUpTwoPlayerBattle(page, context)

    const { attacker, defender, attackerSeat, defenderSeat } = await waitForAttackerTurn(page, page2)
    const regionId = await clickFirstEligibleRegion(attacker)
    expect(regionId).not.toBeNull()

    await expect(attacker.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })
    await expect(defender.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })

    const attackerScoreBefore = await readScore(attacker, attackerSeat)
    const defenderScoreBefore = await readScore(defender, defenderSeat)

    // Neither combatant answers - GameRules.ChoiceQuestionDurationSeconds (12s) or
    // TipQuestionDurationSeconds (20s), whichever this question drew, elapses on its own via
    // TimeoutElapsed. No submission on either side scores Tier 1 or 2 (answer-ranking's "No choice
    // answer scores tier 2" / "No numeric answer scores tier 1"), so both combatants land above
    // Tier 0 and BothAnsweredIncorrectly (GameEngine.Battle.cs) is true either way.
    await expect(attacker.getByTestId('reveal-overlay')).toBeVisible({ timeout: 30_000 })
    await expect(defender.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5_000 })

    expect(await regionOwnerSeatOf(attacker, regionId!)).toBe(defenderSeat)

    await expect(attacker.getByTestId('reveal-overlay')).toBeHidden({ timeout: 15_000 })

    // AskBattleQuestion's TieBreakOrder.Prefer(defender, attacker) places the defender first, so a
    // true tie - including a double timeout - resolves as a defender win exactly like any other
    // defender win: territory stays put, and ApplyDuelOutcome's `else` branch (which covers "a
    // better rank, a tie, or a withdrawn attacker" per its own doc comment) still pays the defender
    // GameRules.BaseAssaultScoreBonus. This matches duel-defense-score-bonus's "A tie favors the
    // defender and pays the bonus" scenario verbatim.
    expect(await regionOwnerSeatOf(attacker, regionId!)).toBe(defenderSeat)
    await expect(attacker.getByTestId(`player-card-${defenderSeat}`).locator('.score')).toHaveText(
      String(defenderScoreBefore + 200),
      { timeout: 10_000 },
    )
    await expect(attacker.getByTestId(`player-card-${attackerSeat}`).locator('.score')).toHaveText(
      String(attackerScoreBefore),
      { timeout: 10_000 },
    )
  })

  test('only adjacent enemy regions are offered as attack targets - never the attacker\'s own territory or a non-adjacent one', async ({
    page,
    context,
  }) => {
    const page2 = await setUpTwoPlayerBattle(page, context)
    const adjacency = loadAdjacency()

    const { attacker, attackerSeat, defenderSeat } = await waitForAttackerTurn(page, page2)

    const ownRegions = new Set(await ownedRegionIds(attacker, attackerSeat))
    const offered = await selectableRegionIds(attacker)
    expect(offered.length, 'expected at least one eligible attack target on the current turn').toBeGreaterThan(0)

    for (const regionId of offered) {
      // Never the attacker's own region (battle-flow: "Selecting a region the attacker already owns
      // is rejected") - with only two players, "not the attacker's" means owned by the defender.
      const owner = await regionOwnerSeatOf(attacker, regionId)
      expect(owner, `offered target ${regionId} should be enemy-owned`).toBe(defenderSeat)

      // Adjacent to at least one of the attacker's own regions (battle-flow: "An attack target must
      // be an enemy region adjacent to the attacker's territory").
      const neighbors = adjacency.get(regionId) ?? new Set<string>()
      const isAdjacentToOwnTerritory = [...neighbors].some((n) => ownRegions.has(n))
      expect(isAdjacentToOwnTerritory, `offered target ${regionId} should border attacker-owned territory`).toBe(true)
    }
  })

  test('RevealHold accepts no input from either page and always advances on its own', async ({ page, context }) => {
    const page2 = await setUpTwoPlayerBattle(page, context)

    const { attacker, defender } = await waitForAttackerTurn(page, page2)
    const regionId = await clickFirstEligibleRegion(attacker)
    expect(regionId).not.toBeNull()

    await expect(attacker.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })
    await expect(defender.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })
    await answerIncorrectly(defender)
    await answerCorrectly(attacker)

    await expect(attacker.getByTestId('reveal-overlay')).toBeVisible({ timeout: 10_000 })
    await expect(defender.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5_000 })

    // battle-flow: "RevealHold accepts only its own timeout" - no question affordance exists on
    // either combatant's page while it is up.
    await expect(attacker.getByTestId('option-0')).toHaveCount(0)
    await expect(attacker.getByTestId('tip-input')).toHaveCount(0)
    await expect(defender.getByTestId('option-0')).toHaveCount(0)
    await expect(defender.getByTestId('tip-input')).toHaveCount(0)

    // No click, no submit anywhere - it advances entirely on its own deadline
    // (GameRules.RevealHoldDurationSeconds, 7s).
    await expect(attacker.getByTestId('reveal-overlay')).toBeHidden({ timeout: 15_000 })
  })

  test('after both players take a turn, the round advances and the next round restarts from seat order', async ({
    page,
    context,
  }) => {
    const page2 = await setUpTwoPlayerBattle(page, context)

    // Drives one full duel to completion (arbitrary answers - only progress matters here), including
    // any follow-up numeric tiebreak a tied-correct Choice duel triggers (answer-ranking's
    // numeric-tiebreak requirement), so the turn genuinely ends before the caller checks whose turn
    // is next.
    async function driveOneAttackTurnToCompletion(attacker: Page, defender: Page): Promise<void> {
      const regionId = await clickFirstEligibleRegion(attacker)
      expect(regionId, 'expected an eligible attack target').not.toBeNull()
      for (let i = 0; i < 3; i++) {
        await expect(attacker.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })
        await expect(defender.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })
        await answerAnyIfAsked(attacker)
        await answerAnyIfAsked(defender)
        await expect(attacker.getByTestId('reveal-overlay')).toBeVisible({ timeout: 15_000 })
        await expect(attacker.getByTestId('reveal-overlay')).toBeHidden({ timeout: 15_000 })
        if (!(await attacker.getByTestId('question-card').isVisible().catch(() => false))) return
      }
    }

    // battle-flow: "Battle starts the instant land grab ends" begins the first player's turn in seat
    // order - seat 0 (Ada/page) should therefore act first.
    const firstTurn = await waitForAttackerTurn(page, page2)
    expect(firstTurn.attackerSeat, 'the very first Battle turn should belong to seat 0').toBe(0)

    await driveOneAttackTurnToCompletion(firstTurn.attacker, firstTurn.defender)

    // Only one of the two players has acted this round - battle-flow: "Turns proceed in seat order,
    // one round per full cycle" - the round counter must not have moved yet.
    expect(await currentRound(page)).toBe(1)

    const secondTurn = await waitForAttackerTurn(page, page2)
    expect(secondTurn.attackerSeat, 'the second turn of round 1 should belong to the other seat').toBe(1)

    await driveOneAttackTurnToCompletion(secondTurn.attacker, secondTurn.defender)

    // Both players have now acted once - a new round begins, and turn order rebuilds from seat order
    // (battle-flow: "A new round rebuilds turn order from the players still active ... in seat
    // order"). Polled rather than read once: the round-progress text and the next TargetSelection
    // are both driven by the same server round-trip that already resolved above, but the client's
    // own re-render can lag a tick behind Playwright's read.
    await expect.poll(() => currentRound(page), { timeout: 10_000 }).toBe(2)
    const thirdTurn = await waitForAttackerTurn(page, page2)
    expect(thirdTurn.attackerSeat, 'round 2 should restart from seat 0').toBe(0)
  })
})
