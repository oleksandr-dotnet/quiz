// Client-side orchestration for the /test-mechanics playground. Every helper here is built purely
// from the two generic sandbox primitives the server exposes (forceExpire/forceAnswer) plus fields
// GameView already exposes to a real player (eligibleTargetRegionIds, isBase, battle context) - none
// of it re-derives a game rule the server hasn't already told the client. See
// components/SandboxControlPanel.tsx for the UI that calls these, and RoomActor.ForceExpireAsync/
// ForceAnswerAsync (Triviador.Application) for what the two primitives actually do server-side.
import { forceAnswer, forceExpire } from '../api/commands'
import { useGameStore } from '../store/gameStore'
import type { GameView } from '../api/contracts'

function currentView(): GameView | null {
  return useGameStore.getState().gameView
}

export type ForcedOutcome = 'best' | 'attacker' | 'defender'

// The one "nudge the game forward by one step" primitive every scenario helper below is built from.
// - A pending question: force every participant who hasn't answered yet, per `outcome`.
//   'best' forces everyone correct (fastest, fair way to blow through land-grab/setup questions
//   that have no attacker/defender). 'attacker'/'defender' force only that role to win the
//   duel/base-assault/self-heal, letting territory shift in a chosen direction.
// - A live reveal hold: resolve it now instead of waiting out its (real, unarmed-timer) window.
// - Anything else pending (base pick, region pick, attack target, category-ban proposal): expire it,
//   which auto-picks the first eligible option exactly as a real timeout would.
export async function advanceOneStep(outcome: ForcedOutcome = 'best'): Promise<void> {
  const view = currentView()
  if (!view) return

  const q = view.pendingQuestion
  if (q) {
    const attacker = view.battle?.attackerPlayerId
    const defender = view.battle?.defenderPlayerId
    for (const playerId of q.participantPlayerIds) {
      if (q.hasAnswered[playerId]) continue
      let wantCorrect = true
      if (outcome === 'attacker' && attacker) wantCorrect = playerId === attacker
      if (outcome === 'defender' && defender) wantCorrect = playerId === defender
      await forceAnswer(playerId, wantCorrect)
    }
    return
  }

  // A reveal hold, an attack-target/region-pick/base-pick/category-ban wait, or (defensively) any
  // other pending shape all resolve the same way: expire it now.
  await forceExpire()
}

// Plays the setup phases (category ban, base selection, land grab) forward with no regard for
// outcome - there's nothing to "win" yet - until the game reaches Battle (or ends, which only
// happens here if every region somehow gets claimed by one side well before round 1's turn order
// even starts, i.e. never in practice, but the check keeps this from spinning forever regardless).
export async function fastForwardToBattle(maxSteps = 250): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const view = currentView()
    if (!view || view.phase === 'Battle' || view.phase === 'Finished') return
    await advanceOneStep('best')
  }
}

// Ends whoever's current attack-target turn is pending without anyone gaining or losing territory
// (both sides forced incorrect - a tie, which the engine always resolves in the defender's favor).
// A quick "move on to the next player" button for a tester who doesn't care about this particular
// turn.
export async function passCurrentTurn(): Promise<void> {
  const view = currentView()
  if (!view?.pendingAttackTarget) return
  await advanceOneStep('defender')
  const afterTarget = currentView()
  if (afterTarget?.pendingQuestion) await advanceOneStep('defender')
  const afterAnswer = currentView()
  if (afterAnswer?.pendingReveal) await advanceOneStep('defender')
}

export type HuntResult = 'ready' | 'timeout' | 'game-over'

// Auto-plays turns (letting whoever's attacking win, so territory actively reshuffles instead of
// sitting static) until it's forPlayerId's turn to pick an attack target AND their enemy's base is
// among the eligible targets - then stops and hands control back, so the tester can click that base
// on the real map themselves and drive the resulting question by hand. Bounded: with only a
// handful of players on the production map, adjacency to a base typically opens up within a few
// turns, but this gives up after maxSteps rather than looping forever if it never does.
export async function huntForBaseTarget(forPlayerId: string, maxSteps = 80): Promise<HuntResult> {
  for (let i = 0; i < maxSteps; i++) {
    const view = currentView()
    if (!view) return 'timeout'
    if (view.phase === 'Finished') return 'game-over'

    const pat = view.pendingAttackTarget
    if (pat && pat.currentAttackerPlayerId === forPlayerId) {
      const hasBaseTarget = pat.eligibleTargetRegionIds.some(
        (id) => view.regions.find((r) => r.regionId === id)?.isBase,
      )
      if (hasBaseTarget) return 'ready'
    }

    await advanceOneStep('attacker')
  }
  return 'timeout'
}
