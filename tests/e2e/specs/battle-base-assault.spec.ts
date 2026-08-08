import { expect, test, type Page } from '@playwright/test'
import {
  answerAnyIfAsked,
  answerCorrectly,
  answerIncorrectly,
  clickFirstEligibleRegion,
  createRoom,
  currentRound,
  fastForwardUntil,
  joinRoomByCode,
  ownedRegionIds,
  readScore,
  roomCodeOf,
  seatRows,
  setLobbySettings,
  startGameAndReachBaseSelection,
} from './helpers'

// Coverage: TEST-PLAN.md section 2.7 / openspec/specs/battle-flow's assault+endgame requirements -
// everything battle-base-assault-bonus.spec.ts (a different, existing file - not touched here) does
// NOT already cover: the round-8 lock/unlock threshold itself, the chain mechanic, HP persistence
// across turns, a full capture -> elimination -> last-player-standing game end, self-heal, and the
// "captured base is worth its ordinary map value, not the 1000 own-base bonus" rule.
//
// Base assaults only unlock at GameRules.BaseAssaultUnlockRound (round 8), so - exactly like the
// bonus spec - this drives a real, minimal two-player (no bot seats) game there, answering every
// question the instant it appears. Reaching round 8 is unavoidable and is the dominant cost of this
// whole file; every scenario below that also needs a round-8-or-later game state is deliberately
// folded into ONE such drive (a single test, with test.step() sections so a failure still names the
// exact scenario that broke) rather than paying to reach round 8 six times over. This is the file the
// team should budget the most CI time for - see the final report for a measured wall-clock time.

/** The single fixed 18-region map's real adjacency (Data/map.json), mirrored here so the "locked
 * before round 8" assertion below can prove a base really is adjacent - not just never offered -
 * at the moment it's asserted absent from the eligible set. Not importable from server-side JSON
 * (this is browser-side Playwright test code), so it's a plain hand-copied constant; if the map ever
 * changes shape, MapValidator would already fail the server's own startup before this file could even
 * run against it. */
const REGION_ADJACENCY: Record<string, string[]> = {
  r01: ['r02', 'r07'],
  r02: ['r01', 'r03', 'r08'],
  r03: ['r02', 'r04', 'r09'],
  r04: ['r03', 'r05', 'r10'],
  r05: ['r04', 'r06', 'r11'],
  r06: ['r05', 'r12'],
  r07: ['r01', 'r08', 'r13'],
  r08: ['r02', 'r07', 'r09', 'r14'],
  r09: ['r03', 'r08', 'r10', 'r15'],
  r10: ['r04', 'r09', 'r11', 'r16'],
  r11: ['r05', 'r10', 'r12', 'r17'],
  r12: ['r06', 'r11', 'r18'],
  r13: ['r07', 'r14'],
  r14: ['r08', 'r13', 'r15'],
  r15: ['r09', 'r14', 'r16'],
  r16: ['r10', 'r15', 'r17'],
  r17: ['r11', 'r16', 'r18'],
  r18: ['r12', 'r17'],
}

/** Picks the current player's base during BaseSelection and returns its region id (mirrors
 * battle-base-assault-bonus.spec.ts's own private helper of the same shape). */
async function pickBase(page: Page): Promise<string> {
  const region = page.locator('g.region.selectable').first()
  await expect(region).toBeVisible({ timeout: 20_000 })
  const testId = await region.getAttribute('data-testid')
  await region.click()
  return testId!.replace('region-', '')
}

async function filledHpPipCount(page: Page, seat: number): Promise<number> {
  return page.getByTestId(`player-card-${seat}`).locator('.hp-pip.filled').count()
}

// TopBar's round-progress number flips via an AnimatePresence (mode="popLayout") transition
// (~0.28s, see App.css) that can leave both the outgoing and incoming round text nodes mounted
// simultaneously mid-flip - a plain .textContent() read taken at exactly the wrong instant (right as
// the round crosses the round-8 unlock boundary) can then pick up the outgoing, about-to-be-stale
// number instead of the current one. A short wait comfortably past the transition's duration before
// reading avoids that - the round number itself only advances when a turn is actually taken, never
// while this function is merely waiting, so the wait can't itself change the answer.
async function settledRound(page: Page): Promise<number> {
  await page.waitForTimeout(400)
  return currentRound(page)
}

// Once the game is Finished, AppShell's own persistent `.shell-roster` (rendered unconditionally on
// every phase) and ResultsDock's separate PlayerRoster (view.tsx sort="score") are BOTH mounted at
// once - a real duplicate-testid situation (`player-card-<seat>` resolves twice in strict mode), not
// a test bug. Every post-finish player-card read below is scoped to results-dock specifically, since
// that's the one actually meant to be "the" results view; the shared readScore/etc. helpers in
// helpers.ts assume exactly one match and would hit the same strict-mode violation, so this scoped
// reader stands in for readScore for the one post-finish score assertion this file needs.
async function readScoreWithinResultsDock(page: Page, seat: number): Promise<number> {
  await page.waitForTimeout(500) // mirrors readScore's own wait past the Odometer's ~320ms animation
  const text = await page.getByTestId('results-dock').getByTestId(`player-card-${seat}`).locator('.score').textContent()
  return Number(text)
}

interface AssaultReady {
  attacker: Page
  defender: Page
  attackerSeat: number
  defenderSeat: number
  opponentBaseId: string
  /** Whether the "locked before round 8" negative assertion was actually exercised (the opponent's
   * base really was adjacent to the eventual attacker's territory at some round below 8) rather than
   * skipped because the two territories simply never touched before then. */
  lockWasProvenBeforeUnlock: boolean
}

/**
 * Advances Battle turns (arbitrary answers/targets, exactly like
 * battle-base-assault-bonus.spec.ts's own driveUntilOpponentBaseIsAttackable) until an opponent's
 * base becomes an eligible attack target for whoever is currently on turn - i.e.
 * GameRules.BaseAssaultUnlockRound has been reached AND the two territories are adjacent there.
 * Additionally - the part that helper doesn't do - on every turn along the way where a base is
 * independently provably adjacent (per REGION_ADJACENCY, not just "whatever the UI happens to
 * offer") to the current attacker's territory but the round is still below 8, asserts it is NOT
 * selectable: this is scenario 2.7.1's negative half (the lock), proven against a base that really
 * would otherwise be reachable. Returning at all (round >= 8, base selectable) is scenario 2.7.1's
 * positive half (the unlock) - asserted explicitly below too, not just implied by the return.
 */
async function driveUntilAssaultReady(page: Page, page2: Page, adaBaseId: string, bobBaseId: string): Promise<AssaultReady> {
  let lockWasProvenBeforeUnlock = false
  const deadline = Date.now() + 300_000
  while (Date.now() < deadline) {
    for (const [attacker, defender, attackerSeat, defenderSeat, opponentBaseId] of [
      [page, page2, 0, 1, bobBaseId],
      [page2, page, 1, 0, adaBaseId],
    ] as const) {
      const hasTurn = await attacker.locator('g.region.selectable').first().isVisible().catch(() => false)
      if (!hasTurn) continue

      const baseRegion = attacker.getByTestId(`region-${opponentBaseId}`)
      const baseClass = await baseRegion.getAttribute('class').catch(() => null)
      const round = await settledRound(attacker)

      if (baseClass?.includes('selectable')) {
        expect(round, 'a base only ever becomes an eligible attack target at/after BaseAssaultUnlockRound (8)').toBeGreaterThanOrEqual(8)
        return { attacker, defender, attackerSeat, defenderSeat, opponentBaseId, lockWasProvenBeforeUnlock }
      }

      if (round < 8) {
        const attackerOwned = await ownedRegionIds(attacker, attackerSeat)
        const isAdjacent = attackerOwned.some((id) => REGION_ADJACENCY[opponentBaseId]?.includes(id))
        if (isAdjacent) {
          expect(
            baseClass,
            `enemy base ${opponentBaseId} is adjacent to seat ${attackerSeat}'s territory at round ${round} (< 8 unlock) and must stay locked`,
          ).not.toContain('selectable')
          lockWasProvenBeforeUnlock = true
        }
      }

      // Not reachable yet (still locked, or not adjacent from here) - take whatever ordinary target
      // is offered instead and keep looking on a later turn.
      await clickFirstEligibleRegion(attacker)
    }

    await answerAnyIfAsked(page)
    await answerAnyIfAsked(page2)
    await page.waitForTimeout(250)
  }
  throw new Error('driveUntilAssaultReady: the opponent base never became an eligible attack target within 300s')
}

/** Resolves the currently-shown two-participant duel/assault question with `winner` answering
 * correctly and `loser` deliberately wrong, then waits out the reveal - the same decisive-win pattern
 * battle-base-assault-bonus.spec.ts uses, generalized to either direction so it can play both the
 * attacker-wins-a-hit and the "attacker loses on purpose to end the chain early" turns below. */
async function resolveDecisively(winner: Page, loser: Page): Promise<void> {
  await expect(winner.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })
  await expect(loser.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })
  await answerCorrectly(winner)
  await answerIncorrectly(loser)
  await expect(winner.getByTestId('reveal-overlay')).toBeVisible({ timeout: 10_000 })
  await expect(winner.getByTestId('reveal-overlay')).toBeHidden({ timeout: 15_000 })
}

/** Resolves a self-heal question (single participant: attacker === defender) either correctly or
 * deliberately wrong, then waits out the reveal. */
async function resolveSelfHeal(page: Page, correct: boolean): Promise<void> {
  await expect(page.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })
  if (correct) {
    await answerCorrectly(page)
  } else {
    await answerIncorrectly(page)
  }
  await expect(page.getByTestId('reveal-overlay')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('reveal-overlay')).toBeHidden({ timeout: 15_000 })
}

test.describe('base assault: lock/unlock, chained damage, persistence, capture, self-heal, and scoring', () => {
  test.setTimeout(600_000)

  test('an assault stays locked until round 8, then chains, persists, heals, and a full capture eliminates and ends the game', async ({
    page,
    context,
  }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    // Deterministic scoring throughout (the final assertion is an exact score-delta formula, which
    // answer streaks or a golden question's doubling would confound), and category-ban skipped since
    // it's unrelated to anything this file covers.
    await setLobbySettings(page, { answerStreaks: false, categoryBanDraft: false, goldenQuestion: false })
    await startGameAndReachBaseSelection([page, page2])

    const adaBaseId = await pickBase(page)
    await expect(page2.locator('.turn-banner')).toBeVisible({ timeout: 20_000 })
    const bobBaseId = await pickBase(page2)

    await fastForwardUntil(page, page2, () => page.getByTestId('battle-dock').isVisible().catch(() => false), 180_000)
    await expect(page.getByTestId('battle-dock')).toBeVisible()
    await expect(page2.getByTestId('battle-dock')).toBeVisible()

    let ready: AssaultReady = null as unknown as AssaultReady
    await test.step('scenario 1: locked before round 8, unlocked at round 8', async () => {
      ready = await driveUntilAssaultReady(page, page2, adaBaseId, bobBaseId)
      expect(
        ready.lockWasProvenBeforeUnlock,
        'expected the eventual defender base to be independently adjacent (per REGION_ADJACENCY) to the ' +
          'attacker at some round below 8 - otherwise the lock assertion above never actually fired',
      ).toBe(true)
    })

    const { attacker, defender, attackerSeat, defenderSeat, opponentBaseId } = ready
    const attackerName = attacker === page ? 'Ada' : 'Bob'

    await test.step('scenario 2: a chained assault - consecutive wins each drop the base by exactly 1 HP, no turn pass', async () => {
      expect(await filledHpPipCount(defender, defenderSeat)).toBe(5)

      await attacker.getByTestId(`region-${opponentBaseId}`).click()

      // Hit 1: attacker wins - HP drops by exactly 1 and another question is asked immediately,
      // without ever passing through a fresh target-selection or handing the turn to the defender.
      await resolveDecisively(attacker, defender)
      expect(await filledHpPipCount(defender, defenderSeat)).toBe(4)
      await expect(attacker.getByTestId('question-card')).toBeVisible({ timeout: 10_000 })

      // Hit 2: same again - proves "no fixed limit on how many consecutive questions", not just one.
      await resolveDecisively(attacker, defender)
      expect(await filledHpPipCount(defender, defenderSeat)).toBe(3)
      await expect(attacker.getByTestId('question-card')).toBeVisible({ timeout: 10_000 })
    })

    await test.step('scenario 3: a defender win ends the assault immediately, keeping the damage already dealt', async () => {
      // Attacker deliberately loses this one - the chain must stop here with HP still at 3, not
      // regenerate, and the turn must pass to the defender.
      await resolveDecisively(defender, attacker)
      expect(await filledHpPipCount(defender, defenderSeat)).toBe(3)
    })

    await test.step('scenario 5: self-heal - a damaged own-base is a legal self-target once unlocked', async () => {
      // 2-player symmetry: whichever seat the attacker was, the defender always takes the very next
      // turn (either they're still owed a turn this same round, or - if the attacker went second -
      // the round they just ended was already the defender's last remaining slot, so a fresh round
      // starts with the defender first). The defender's own base is still damaged from scenario 2/3,
      // so it's the exact "damaged base becomes self-targetable" state this scenario needs, with no
      // extra drive required to manufacture it.
      await expect(defender.getByTestId(`region-${opponentBaseId}`)).toBeVisible({ timeout: 20_000 })
      await defender.getByTestId(`region-${opponentBaseId}`).click()

      // A correct heal: +1 HP, and the turn keeps going (defender is immediately offered another
      // target selection, still their own turn - proven by targeting their own base again below
      // without the attacker ever having acted in between).
      await resolveSelfHeal(defender, true)
      expect(await filledHpPipCount(defender, defenderSeat)).toBe(4)

      await expect(defender.getByTestId(`region-${opponentBaseId}`)).toBeVisible({ timeout: 20_000 })
      await defender.getByTestId(`region-${opponentBaseId}`).click()

      // A wrong/inexact heal: HP unchanged, and this time the turn actually ends.
      await resolveSelfHeal(defender, false)
      expect(await filledHpPipCount(defender, defenderSeat)).toBe(4)
      await expect(attacker.locator('g.region.selectable').first()).toBeVisible({ timeout: 20_000 })
    })

    await test.step('scenario 4 & 6: finishing the capture eliminates the defender, ends the game, and scores the base at ordinary value', async () => {
      const defenderRegionsBeforeCapture = await ownedRegionIds(defender, defenderSeat)
      const attackerScoreBeforeFinalChain = await readScore(attacker, attackerSeat)

      await expect(attacker.getByTestId(`region-${opponentBaseId}`)).toBeVisible({ timeout: 20_000 })
      await attacker.getByTestId(`region-${opponentBaseId}`).click()

      let wins = 0
      let finished = false
      while (!finished) {
        wins += 1
        if (wins > 6) {
          throw new Error(`finishing chain: base still not captured after ${wins} attacker wins - HP should never start above 5`)
        }
        const hpBefore = await filledHpPipCount(defender, defenderSeat)
        await resolveDecisively(attacker, defender)

        finished = await attacker.getByTestId('results-dock').isVisible().catch(() => false)
        if (!finished) {
          expect(await filledHpPipCount(defender, defenderSeat)).toBe(hpBefore - 1)
          await expect(attacker.getByTestId('question-card')).toBeVisible({ timeout: 10_000 })
        }
      }

      // Game over: last-player-standing, immediately, on both pages.
      await expect(attacker.getByTestId('results-dock')).toBeVisible({ timeout: 15_000 })
      await expect(defender.getByTestId('results-dock')).toBeVisible({ timeout: 15_000 })
      await expect(attacker.getByTestId('winner-celebration')).toContainText(attackerName)
      await expect(defender.getByTestId('winner-celebration')).toContainText(attackerName)
      const attackerResultsDefenderCard = attacker.getByTestId('results-dock').getByTestId(`player-card-${defenderSeat}`)
      await expect(attackerResultsDefenderCard).toHaveClass(/eliminated/)
      await expect(attackerResultsDefenderCard.locator('.fallen-banner')).toBeVisible()

      // Every region the defender owned - not just the base - transferred to the attacker.
      const attackerRegionsAfter = await ownedRegionIds(attacker, attackerSeat)
      expect(attackerRegionsAfter).toContain(opponentBaseId)
      for (const regionId of defenderRegionsBeforeCapture) {
        expect(attackerRegionsAfter).toContain(regionId)
      }

      // Scenario 6, proven by an exact-delta formula rather than eyeballing one final number: this
      // finishing chain paid GameRules.BaseAssaultScoreBonus (200) once per question won (`wins` of
      // them - every hit in a chain pays it, not just the one that ends it), PLUS the ordinary map
      // value (200 - every region on this map is worth 200, see Data/map.json) of every region the
      // defender owned, including their base - which is exactly what would be wrong by 800 per base
      // if a regression made a captured base keep paying its former owner's 1000-point own-base bonus
      // instead of becoming ordinary territory.
      const attackerScoreAfter = await readScoreWithinResultsDock(attacker, attackerSeat)
      expect(attackerScoreAfter).toBe(attackerScoreBeforeFinalChain + 200 * wins + 200 * defenderRegionsBeforeCapture.length)
    })
  })
})
