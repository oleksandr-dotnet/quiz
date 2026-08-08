import { expect, test, type Page } from '@playwright/test'
import {
  answerAnyIfAsked,
  answerCorrectly,
  answerIncorrectly,
  clickFirstEligibleRegion,
  createRoom,
  fastForwardUntil,
  joinRoomByCode,
  readScore,
  roomCodeOf,
  seatRows,
  setLobbySettings,
  startGameAndReachBaseSelection,
} from './helpers'

// Coverage: openspec/changes/base-assault-bonus-and-numeric-tiebreak's battle-flow delta - a resolved
// base-assault question moves GameRules.BaseAssaultScoreBonus (200) between attacker and defender,
// independent of territory. Reaching a base assault needs GameRules.BaseAssaultUnlockRound (round 8)
// - per this change's e2e-test-tooling delta, a deliberately minimal two-player game (no bot seats)
// with every question answered the instant it appears keeps this within a practical run time, since
// the only unavoidable per-question cost is the fixed RevealHold window.
//
// The assertion only needs a single resolved assault question against a full-health base
// (BaseHitPointsDefault 5, so one hit never captures it): whoever wins, BonusScore moves by exactly
// +/-200 with no territory transfer to confound the read. The defender is made to answer wrong on
// purpose (using the same content-bank lookup the numeric-tiebreak spec uses) so this one question
// always resolves outright, with no chance of triggering the numeric-tiebreak path this change also
// adds (that path needs both combatants correct - impossible when the defender is deliberately wrong).

async function pickBase(page: Page): Promise<string> {
  const region = page.locator('g.region.selectable').first()
  await expect(region).toBeVisible({ timeout: 20_000 })
  const testId = await region.getAttribute('data-testid')
  await region.click()
  return testId!.replace('region-', '')
}

interface AttackerTurn {
  attacker: Page
  defender: Page
  attackerSeat: number
  defenderSeat: number
  opponentBaseId: string
}

/**
 * Advances Battle turns (arbitrary answers/targets) until the opponent's base becomes an eligible
 * attack target for whoever is currently on turn - i.e. GameRules.BaseAssaultUnlockRound has been
 * reached AND the two territories happen to be adjacent there. Returns without attacking it yet.
 */
async function driveUntilOpponentBaseIsAttackable(
  page: Page,
  page2: Page,
  adaBaseId: string,
  bobBaseId: string,
): Promise<AttackerTurn> {
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
      if (baseClass?.includes('selectable')) {
        return { attacker, defender, attackerSeat, defenderSeat, opponentBaseId }
      }

      // Not reachable yet (either still locked, or not adjacent from here) - take whatever ordinary
      // target is offered instead and keep looking on a later turn.
      await clickFirstEligibleRegion(attacker)
    }

    await answerAnyIfAsked(page)
    await answerAnyIfAsked(page2)
    await page.waitForTimeout(250)
  }
  throw new Error('driveUntilOpponentBaseIsAttackable: the opponent base never became an eligible attack target within 300s')
}

test.describe('base-assault score bonus', () => {
  test.setTimeout(480_000)

  test('winning or losing a single base-assault question moves exactly +/-200, independent of territory', async ({
    page,
    context,
  }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    // Deterministic scoring: this test asserts an exact +/-200 delta, which answer streaks (+50 x
    // streak) or a golden question (doubling) would confound. Category-ban draft is pinned off too,
    // purely so this test doesn't need to also drive through that phase for a scenario that has
    // nothing to do with it.
    await setLobbySettings(page, { answerStreaks: false, categoryBanDraft: false, goldenQuestion: false })

    await startGameAndReachBaseSelection([page, page2])

    const adaBaseId = await pickBase(page)
    await expect(page2.locator('.turn-banner')).toBeVisible({ timeout: 20_000 })
    const bobBaseId = await pickBase(page2)

    await fastForwardUntil(page, page2, () => page.getByTestId('battle-dock').isVisible().catch(() => false), 180_000)
    await expect(page.getByTestId('battle-dock')).toBeVisible()
    await expect(page2.getByTestId('battle-dock')).toBeVisible()

    const { attacker, defender, attackerSeat, defenderSeat, opponentBaseId } = await driveUntilOpponentBaseIsAttackable(
      page,
      page2,
      adaBaseId,
      bobBaseId,
    )

    const attackerScoreBefore = await readScore(attacker, attackerSeat)
    const defenderScoreBefore = await readScore(defender, defenderSeat)

    await attacker.getByTestId(`region-${opponentBaseId}`).click()

    await expect(attacker.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })
    await expect(defender.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })

    // The attacker answers correctly and the defender is deliberately wrong (for a Choice question,
    // one slot off the correct one; for a Tip question, a million off - Tip correctness is closeness,
    // not exactness, so this is a decisive miss regardless of the question's own unit/scale). This
    // guarantees a decisive attacker win by tier alone (no ambiguity from elapsed time or tie-break
    // order) and no chance of the "both correct" numeric-tiebreak path also added by this change -
    // that path is already covered by battle-numeric-tiebreak.spec.ts.
    await answerIncorrectly(defender)
    await answerCorrectly(attacker)

    await expect(attacker.getByTestId('reveal-overlay')).toBeVisible({ timeout: 10_000 })
    await expect(attacker.getByTestId('reveal-overlay')).toBeHidden({ timeout: 15_000 })

    // A full-health base (BaseHitPointsDefault 5) never falls to a single hit, so no territory
    // changes hands here - the only possible score movement is the +/-200 bonus itself.
    await expect(attacker.getByTestId(`player-card-${attackerSeat}`).locator('.score')).toHaveText(
      String(attackerScoreBefore + 200),
      { timeout: 10_000 },
    )
    await expect(defender.getByTestId(`player-card-${defenderSeat}`).locator('.score')).toHaveText(
      String(defenderScoreBefore - 200),
      { timeout: 10_000 },
    )

    // The base-assault bonus proclamation (App.tsx's baseAssaultBonusWonProclamation) surfaces on
    // whichever side won - the defender was deliberately wrong, so the attacker won this exchange.
    await expect(attacker.getByRole('alert').first()).toContainText('200', { timeout: 5_000 })
  })
})
