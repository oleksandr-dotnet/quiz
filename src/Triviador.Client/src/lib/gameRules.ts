// Mirrors one GameRules default the client needs for display (see lib/timers.ts for the duration
// mirrors this file's sibling covers). Source of truth is Triviador.Domain/State/GameRules.cs -
// keep in sync by hand; there is no automated check for drift (see CLAUDE.md's contracts.ts note).
export const BASE_HIT_POINTS_DEFAULT = 5 // GameRules.BaseHitPointsDefault
export const BASE_ASSAULT_SCORE_BONUS = 200 // GameRules.BaseAssaultScoreBonus
// Unlike RoundLimit, this doesn't vary between the Default and Marathon presets, so it's safe to
// quote as a fixed number in player-facing copy (see HowToPlayModal).
export const BASE_ASSAULT_UNLOCK_ROUND = 8 // GameRules.BaseAssaultUnlockRound
export const MINIMUM_BASE_DISTANCE = 2 // GameRules.MinimumBaseDistance
