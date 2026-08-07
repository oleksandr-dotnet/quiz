## Why

Successfully defending a base already earns the defender 200 points via `GameRules.BaseAssaultScoreBonus`
(see the archived `2026-08-06-base-assault-bonus-and-numeric-tiebreak` change), but that change
deliberately left ordinary territory duels untouched. Playtesting feedback is that defending a
non-base region feels just as weightless as defending a base did before that bonus existed: a
defender who wins a duel keeps the region (which was already theirs) and gets nothing else. Players
expect a successful territorial defense to matter the same way a successful base defense does.

## What Changes

- **Duel-defense score bonus**: when a duel over a non-base region resolves with the defender
  winning (including a tie, which is already defender-favored), the defender's `BonusScore` gains a
  fixed amount, reusing `GameRules.BaseAssaultScoreBonus` (200 by default) as the same tunable base
  assaults already use. This is **defender-only and asymmetric**, unlike the base-assault bonus: the
  attacker's score is not reduced when a duel attack fails, and no bonus is paid to either side when
  the attacker wins (the attacker already gains the captured region's territory value).
- A new domain event (distinct from `BaseAssaultScoreAdjusted`, whose doc comment explicitly
  excludes ordinary duels and whose shape is a symmetric winner/loser pair) reports the one-sided
  duel-defense bonus so the host and client can log and surface it the same way the existing
  base-assault bonus is surfaced.
- The bonus is visible in `PlayerView.score` immediately (folded into the existing derived score,
  same as the base-assault bonus) and surfaced to players as a proclamation, mirroring the existing
  `baseAssaultScoreAdjusted` client transition/proclamation pattern but for the defender-only case.

## Capabilities

### Modified Capabilities
- `battle-flow`: replaces the existing "Ordinary duels are unaffected" scenario (under the
  base-assault score-bonus requirement) with a new requirement describing the duel-defense bonus:
  the defender gains `GameRules.BaseAssaultScoreBonus` on a successful defense (win or tie), the
  attacker's score is never reduced on a failed attack, and no bonus is paid on an attacker win.

## Impact

- `src/Triviador.Domain/Engine/GameEngine.Battle.cs` - `ApplyDuelOutcome` gains the defender-only
  bonus mutation when the attacker does not win.
- `src/Triviador.Domain/Events/GameEvents.cs` - a new event for the one-sided duel-defense bonus.
- `src/Triviador.Domain/State/PlayerState.cs` - `BonusScore` doc comment updated to mention both
  sources.
- `src/Triviador.Application/Hosting/RoomActor.cs` - logs the new event alongside
  `BaseAssaultScoreAdjusted`.
- `src/Triviador.Client/src/hooks/useGameTransitions.ts`, `App.tsx`, `lib/gameRules.ts`,
  `i18n/resources/{en,ru}.json` - a parallel client-side transition derivation, proclamation copy,
  and translations for the duel-defense bonus, following the existing
  `baseAssaultScoreAdjusted`/`app.baseAssaultBonusWonProclamation` pattern.
