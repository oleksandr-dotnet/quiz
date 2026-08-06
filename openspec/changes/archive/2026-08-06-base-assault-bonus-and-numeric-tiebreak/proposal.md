## Why

Two playtesting-driven rule changes, requested together:

- Defending (or breaking) a capital feels weightless right now: a base assault only ever moves hit
  points and, eventually, territory. There's no reward for successfully defending your base turn
  after turn, and no extra credit for the attacker beyond the territory they'd get anyway once it
  falls. The desired behavior gives both sides a stake in every single base-assault question, not
  just the final one: win it and gain 200 points untied to any territory, lose it and give up 200.
- Regular territory attacks (duels) currently let a faster wrong-ish guess or a faster correct guess
  matter before correctness is fully settled between the two combatants. For a 4-option question,
  the desired behavior is: correctness decides first; if both combatants answer correctly, the
  question is a wash and an immediate follow-up numeric question - always closeness-based - breaks
  the tie. Elapsed time only matters as the very last resort, when even the numeric tiebreak itself
  comes out exactly even (same distance from the correct number, including both being exactly
  right).

## What Changes

- **Base-assault score bonus**: every base-assault question that resolves (each hit in a chain, and
  the question that ends a chain on a tie/defender win) now also adjusts a new, non-territory score
  component by a fixed `GameRules.BaseAssaultScoreBonus` (200 by default): the winner of that single
  question gains it, the loser gives it up. This applies only to base assaults - ordinary duels and
  self-heals are untouched. The bonus is visible in `PlayerView.score` immediately (folded into the
  existing derived score) and surfaced to players as a proclamation.
- **Numeric tiebreak for tied-correct duels/assaults**: when a Choice-kind duel or base-assault
  question resolves with both attacker and defender answering correctly, elapsed time is no longer
  consulted at all for that question. Instead, one more question - always numeric (Tip) - is asked to
  the same two combatants; whoever is numerically closer to the correct value wins the exchange. Only
  if that numeric tiebreak is itself exactly even (equal distance, including both being exactly
  correct) does elapsed time finally decide, exactly as numeric answers already rank today. This
  changes nothing about Tip questions asked as the *first* question of a duel/assault (already ranked
  by closeness, then time) or about land grab (untouched, still a multi-player ranking where ties
  fall to the seeded shuffle order).

## Capabilities

### Modified Capabilities
- `answer-ranking`: documents the new numeric-tiebreak path for a Choice-question duel/base-assault
  tie on correctness, and that it, too, ultimately falls back to the existing tier/penalty/elapsed/
  tie-break order once it has its own numeric answers to rank.
- `battle-flow`: documents the base-assault score bonus (won/lost once per resolved assault
  question, independent of territory) and the numeric-tiebreak question that a tied-correct Choice
  duel/assault question triggers before either territory or hit points change.
- `e2e-test-tooling`: documents that the suite can be pointed at an already-running deployment
  (production) via an environment variable instead of always booting local dev servers, and that a
  scenario needing many real-time turns (reaching the base-assault-unlock round) uses a deliberately
  minimal two-player game to stay within a practical run time.

## Impact

- `src/Triviador.Domain/State/PlayerState.cs`, `GameState.cs`, `GameRules.cs` - a new persisted,
  non-territory `BonusScore` field folded into `ScoreOf`; a new `BaseAssaultScoreBonus` tunable.
- `src/Triviador.Domain/State/QuestionPurpose.cs`, `Events/GameEvents.cs` - a new `NumericTiebreak`
  purpose wrapping the original `Duel`/`BaseAssault`; a new `BaseAssaultScoreAdjusted` event.
- `src/Triviador.Domain/Engine/GameEngine.Battle.cs`, `GameEngine.LandGrab.cs` - the tiebreak trigger
  check, the score-bonus mutation, and routing a `NumericTiebreak`'s own resolved result back through
  the original purpose's effect.
- `src/Triviador.Application/Contracts/GameViewDto.cs`, `Hosting/RoomActor.cs` - `BattleContextDto`
  gains `IsTiebreakRound`; `ToBattleContext` handles the new purpose; `LogNotableEvents` logs the new
  event.
- `src/Triviador.Client/src/api/contracts.ts`, `screens/BattleScreen.tsx`,
  `hooks/useGameTransitions.ts`, `App.tsx`, `lib/gameRules.ts`, `i18n/resources/{en,ru}.json` - mirror
  the new DTO field, a tiebreak headline, a score-bonus proclamation derived from the existing
  view-diffing pattern (no new server push needed).
- `tests/e2e/specs/` - two new spec files exercising both features against a real running game; a
  small `playwright.config.ts` change to support pointing at a deployed URL.
- `.github/workflows/` - a new, manually-triggered workflow running the Playwright suite against the
  production URL.
