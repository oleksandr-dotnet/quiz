import type { GameView, RecapHighlight, RecapPayload, RecapPlayer, RecapRegionOwnership } from '../api/contracts'
import { deriveGameTransitions } from './gameTransitions'
import { playerDisplayName } from './format'

export interface MatchLog {
  maxStreakByPlayer: Record<string, number>
  highlights: RecapHighlight[]
}

export const EMPTY_MATCH_LOG: MatchLog = { maxStreakByPlayer: {}, highlights: [] }

const EMPTY_HIGHLIGHT = {
  attackerPlayerId: null,
  defenderPlayerId: null,
  baseRegionId: null,
  attackerWon: null,
  winnerPlayerIds: null,
  categories: null,
} as const

// A base-assault question that just resolved (see deriveGameTransitions's own comment on
// baseAssaultScoreAdjusted) - attacker/defender/region come from `previous.battle`, the same
// BattleContextView the transition itself was derived against, rather than re-deriving the
// resolution logic a second time here.
function detectBaseAssaultHighlight(
  transitions: ReturnType<typeof deriveGameTransitions>,
  previous: GameView | null,
): RecapHighlight | null {
  const t = transitions.find((t) => t.kind === 'baseAssaultScoreAdjusted')
  if (!t || t.kind !== 'baseAssaultScoreAdjusted' || !previous?.battle || previous.battle.kind !== 'BaseAssault') {
    return null
  }
  return {
    ...EMPTY_HIGHLIGHT,
    kind: 'BaseAssault',
    attackerPlayerId: previous.battle.attackerPlayerId,
    defenderPlayerId: previous.battle.defenderPlayerId,
    baseRegionId: previous.battle.contestedRegionId,
    attackerWon: t.winnerPlayerId === previous.battle.attackerPlayerId,
  }
}

// A golden question's reveal appearing for the first time (see golden-question's
// hidden-until-reveal contract) - captured on arrival, not on close, since a RevealHold's answers
// (and their ranks) are already final the instant it appears. Land-grab/category-ban resolutions
// push through `lastReveal` (a one-shot broadcast); Battle's timed hold uses `pendingReveal`.
function detectGoldenQuestionHighlight(current: GameView, previous: GameView | null): RecapHighlight | null {
  const currentReveal = current.lastReveal?.isGolden
    ? { reveal: current.lastReveal, prevId: previous?.lastReveal?.prompt.questionId }
    : current.pendingReveal?.isGolden
      ? { reveal: current.pendingReveal, prevId: previous?.pendingReveal?.prompt.questionId }
      : null
  if (!currentReveal || currentReveal.reveal.prompt.questionId === currentReveal.prevId) {
    return null
  }

  return {
    ...EMPTY_HIGHLIGHT,
    kind: 'GoldenQuestion',
    winnerPlayerIds: currentReveal.reveal.answers.filter((a) => a.rank === 1).map((a) => a.playerId),
  }
}

// Called once per applyGameView (see gameStore) to fold one more snapshot into the running,
// whole-match recap log - the same snapshot-diffing deriveGameTransitions already does for
// in-the-moment toasts, reused here to accumulate a persistent history instead of a transient one.
export function updateMatchLog(log: MatchLog, current: GameView, previous: GameView | null): MatchLog {
  const maxStreakByPlayer = { ...log.maxStreakByPlayer }
  for (const p of current.players) {
    if ((maxStreakByPlayer[p.playerId] ?? 0) < p.answerStreak) {
      maxStreakByPlayer[p.playerId] = p.answerStreak
    }
  }

  const transitions = deriveGameTransitions(current, previous)
  const newHighlights: RecapHighlight[] = []

  const assault = detectBaseAssaultHighlight(transitions, previous)
  if (assault) newHighlights.push(assault)

  const categoryBans = transitions.find((t) => t.kind === 'categoryBansResolved')
  if (categoryBans && categoryBans.kind === 'categoryBansResolved') {
    newHighlights.push({ ...EMPTY_HIGHLIGHT, kind: 'CategoryBansResolved', categories: categoryBans.categories })
  }

  const golden = detectGoldenQuestionHighlight(current, previous)
  if (golden) newHighlights.push(golden)

  if (newHighlights.length === 0) return { maxStreakByPlayer, highlights: log.highlights }
  return { maxStreakByPlayer, highlights: [...log.highlights, ...newHighlights] }
}

// Assembled the instant a match reaches Finished, from data the client already legitimately holds
// (the final GameView snapshot plus the whole-match log accumulated along the way) - never a new
// server round-trip. Only persisted server-side if the player goes on to click "share" (see
// add-shareable-game-recap's design.md Decision 1).
export function buildRecapPayload(finalView: GameView, roomCode: string, log: MatchLog): RecapPayload {
  const players: RecapPlayer[] = finalView.players.map((p) => ({
    playerId: p.playerId,
    displayName: playerDisplayName(p),
    avatarId: p.avatarId,
    isBot: p.isBot,
    finalScore: p.score,
    territoriesHeld: finalView.regions.filter((r) => r.ownerPlayerId === p.playerId).length,
    longestStreak: Math.max(log.maxStreakByPlayer[p.playerId] ?? 0, p.answerStreak),
    eliminated: p.eliminated,
  }))

  const regionOwnership: RecapRegionOwnership[] = finalView.regions.map((r) => ({
    regionId: r.regionId,
    ownerPlayerId: r.ownerPlayerId,
  }))

  return {
    roomCode,
    finishedAtUtc: new Date().toISOString(),
    roundsPlayed: finalView.currentRound,
    language: finalView.language,
    mapViewBox: finalView.mapViewBox,
    winnerPlayerIds: finalView.outcome?.winnerPlayerIds ?? [],
    players,
    regionOwnership,
    highlights: log.highlights,
  }
}
