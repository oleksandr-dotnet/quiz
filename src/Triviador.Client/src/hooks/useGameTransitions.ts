import { useMemo } from 'react'
import type { GamePhase, GameView } from '../api/contracts'

export type GameTransition =
  | { kind: 'phaseChanged'; from: GamePhase; to: GamePhase }
  | { kind: 'roundAdvanced'; round: number }
  | { kind: 'regionClaimed'; regionId: string; ownerPlayerId: string }
  | { kind: 'regionCaptured'; regionId: string; fromPlayerId: string; toPlayerId: string }
  | { kind: 'baseDamaged'; playerId: string; remaining: number }
  | { kind: 'baseCaptured'; defenderPlayerId: string; attackerPlayerId: string; transferredRegionIds: string[] }
  | { kind: 'playerEliminated'; playerId: string }
  | { kind: 'scoreDelta'; playerId: string; delta: number }
  | { kind: 'baseAssaultScoreAdjusted'; winnerPlayerId: string; loserPlayerId: string }
  | { kind: 'duelDefenseScoreAwarded'; defenderPlayerId: string; attackerPlayerId: string }
  | { kind: 'categoryBansResolved'; categories: string[] }

// Derives what changed between two consecutive server snapshots. The server broadcasts only full
// snapshots (no event/delta channel - see design.md), so this is the only way the client learns
// what just happened. One snapshot can encode several of these at once (a single RevealHold
// timeout can produce base damage *and* a base capture *and* an elimination *and* a round advance
// together) - callers that stagger these into set-pieces should play them in the order returned,
// not assume at most one transition per snapshot.
export function useGameTransitions(current: GameView | null, previous: GameView | null): GameTransition[] {
  return useMemo(() => {
    if (!current || !previous) return []
    const transitions: GameTransition[] = []

    if (previous.phase !== current.phase) {
      transitions.push({ kind: 'phaseChanged', from: previous.phase, to: current.phase })
    }
    if (current.currentRound > previous.currentRound) {
      transitions.push({ kind: 'roundAdvanced', round: current.currentRound })
    }
    // The draft phase always hands off straight into BaseSelection the instant it resolves (see
    // category-ban-draft), so "just left CategoryBan" is exactly "the draft just resolved" - a
    // precise, one-shot signal independent of whether the resulting set happens to be non-empty.
    if (previous.phase === 'CategoryBan' && current.phase !== 'CategoryBan' && current.bannedCategories.length > 0) {
      transitions.push({ kind: 'categoryBansResolved', categories: current.bannedCategories })
    }

    const prevPlayers = new Map(previous.players.map((p) => [p.playerId, p]))
    const newlyEliminated = new Set(
      current.players.filter((p) => p.eliminated && !prevPlayers.get(p.playerId)?.eliminated).map((p) => p.playerId),
    )

    for (const p of current.players) {
      const prevP = prevPlayers.get(p.playerId)
      if (!prevP) continue
      if (p.score !== prevP.score) {
        transitions.push({ kind: 'scoreDelta', playerId: p.playerId, delta: p.score - prevP.score })
      }
      if (
        p.baseHitPoints !== null &&
        prevP.baseHitPoints !== null &&
        p.baseHitPoints < prevP.baseHitPoints &&
        !newlyEliminated.has(p.playerId)
      ) {
        transitions.push({ kind: 'baseDamaged', playerId: p.playerId, remaining: p.baseHitPoints })
      }
    }

    const prevRegions = new Map(previous.regions.map((r) => [r.regionId, r]))
    const transferredByDefender = new Map<string, string[]>()

    for (const r of current.regions) {
      const prevR = prevRegions.get(r.regionId)
      if (!prevR || prevR.ownerPlayerId === r.ownerPlayerId || !r.ownerPlayerId) continue

      if (!prevR.ownerPlayerId) {
        transitions.push({ kind: 'regionClaimed', regionId: r.regionId, ownerPlayerId: r.ownerPlayerId })
      } else if (newlyEliminated.has(prevR.ownerPlayerId)) {
        const list = transferredByDefender.get(prevR.ownerPlayerId) ?? []
        list.push(r.regionId)
        transferredByDefender.set(prevR.ownerPlayerId, list)
      } else {
        transitions.push({ kind: 'regionCaptured', regionId: r.regionId, fromPlayerId: prevR.ownerPlayerId, toPlayerId: r.ownerPlayerId })
      }
    }

    for (const [defenderPlayerId, transferredRegionIds] of transferredByDefender) {
      const attackerPlayerId = current.regions.find((r) => r.regionId === transferredRegionIds[0])?.ownerPlayerId ?? ''
      transitions.push({ kind: 'baseCaptured', defenderPlayerId, attackerPlayerId, transferredRegionIds })
    }

    for (const playerId of newlyEliminated) {
      transitions.push({ kind: 'playerEliminated', playerId })
    }

    // A base-assault question (never a self-heal, where attacker === defender) that had its reveal
    // open in the previous snapshot and no longer does in this one just resolved - see
    // battle-flow's score-bonus requirement. Whether the attacker or defender won it is read off
    // whether a baseDamaged/baseCaptured transition fired for the defender in this same batch
    // (attacker won) or neither did (defender won or tied) - both already computed above.
    const prevBattle = previous.battle
    const revealJustClosed = previous.pendingReveal !== null && current.pendingReveal === null
    if (revealJustClosed && prevBattle?.kind === 'BaseAssault' && prevBattle.attackerPlayerId !== prevBattle.defenderPlayerId) {
      const attackerWon = transitions.some(
        (t) =>
          (t.kind === 'baseDamaged' && t.playerId === prevBattle.defenderPlayerId) ||
          (t.kind === 'baseCaptured' && t.defenderPlayerId === prevBattle.defenderPlayerId),
      )
      transitions.push({
        kind: 'baseAssaultScoreAdjusted',
        winnerPlayerId: attackerWon ? prevBattle.attackerPlayerId : prevBattle.defenderPlayerId,
        loserPlayerId: attackerWon ? prevBattle.defenderPlayerId : prevBattle.attackerPlayerId,
      })
    }

    // A duel's reveal that just closed either transferred its contested region to the attacker
    // (regionCaptured already computed above) or left it with the defender - the latter is a
    // successful defense and pays the defender-only bonus. Mirrors the BaseAssault derivation
    // above, but one-sided since there's no attacker-loses-points counterpart for duels.
    if (revealJustClosed && prevBattle?.kind === 'Duel') {
      const attackerCaptured = transitions.some(
        (t) => t.kind === 'regionCaptured' && t.regionId === prevBattle.contestedRegionId,
      )
      if (!attackerCaptured) {
        transitions.push({
          kind: 'duelDefenseScoreAwarded',
          defenderPlayerId: prevBattle.defenderPlayerId,
          attackerPlayerId: prevBattle.attackerPlayerId,
        })
      }
    }

    return transitions
  }, [current, previous])
}
