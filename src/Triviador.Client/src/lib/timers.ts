import type { QuestionKind } from '../api/contracts'

// Mirrors GameRules' duration defaults. Used only to size the Timer arc's percentage (a cosmetic
// detail) - the server's own deadline is always the source of truth for when an activity actually
// expires, this is never used to decide legality or timing.
export const TIMER_TOTALS_MS = {
  basePick: 15_000,
  landGrabPick: 10_000,
  attackTargetSelection: 15_000,
  revealHold: 4_000,
}

export function questionTotalMs(kind: QuestionKind): number {
  return kind === 'Tip' ? 20_000 : 12_000
}
