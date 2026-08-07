## 1. Domain

- [x] 1.1 Add `DuelDefenseScoreAwarded(PlayerId DefenderId, PlayerId AttackerId, RegionId RegionId, int Amount)` to `src/Triviador.Domain/Events/GameEvents.cs`, with a doc comment explaining it's the one-sided duel counterpart to `BaseAssaultScoreAdjusted` and reuses `GameRules.BaseAssaultScoreBonus`'s value.
- [x] 1.2 In `ApplyDuelOutcome` (`src/Triviador.Domain/Engine/GameEngine.Battle.cs`), add an `else` branch to the existing capture `if`: award `_state.Rules.BaseAssaultScoreBonus` to `duel.Defender`'s `BonusScore` and emit `DuelDefenseScoreAwarded`.
- [x] 1.3 Update the `BonusScore` doc comment in `src/Triviador.Domain/State/PlayerState.cs` to mention both the base-assault and duel-defense sources.
- [x] 1.4 Update the comment above `BaseAssaultScoreBonus` in `src/Triviador.Domain/State/GameRules.cs` to note it's now shared by both base-assault and duel-defense bonuses.

## 2. Application

- [x] 2.1 Add a `DuelDefenseScoreAwarded` case to `LogNotableEvents` in `src/Triviador.Application/Hosting/RoomActor.cs`, alongside the existing `BaseAssaultScoreAdjusted` case.

## 3. Client

- [x] 3.1 Add a `duelDefenseScoreAwarded` transition kind to `GameTransition` in `src/Triviador.Client/src/hooks/useGameTransitions.ts` and derive it: when `previous.battle?.kind === 'Duel'`, the reveal just closed, and no `regionCaptured` transition fired for that region in the same batch, push `{ kind: 'duelDefenseScoreAwarded', defenderPlayerId, attackerPlayerId }`.
- [x] 3.2 In `src/Triviador.Client/src/App.tsx`, add a proclamation branch for `duelDefenseScoreAwarded` shown only to the defending player (`app.duelDefenseBonusProclamation`), using the existing `BASE_ASSAULT_SCORE_BONUS` constant from `lib/gameRules.ts` for the amount.
- [x] 3.3 Add `app.duelDefenseBonusProclamation` to `src/Triviador.Client/src/i18n/resources/en.json` and `ru.json`, matching the tone of the existing `app.baseAssaultBonusWonProclamation` strings.

## 4. Verification

- [x] 4.1 `dotnet build` succeeds with no warnings from the new event/branch.
- [x] 4.2 `cd src/Triviador.Client && npx tsc -b --noEmit` passes.
- [ ] 4.3 Manually play a duel to defender-win (or tie) in a running game and confirm: the defender's displayed score/base value increases by 200 on the map/HUD, and the proclamation appears only for the defender, not the attacker.
- [ ] 4.4 Manually play a duel to attacker-win and confirm no score bonus and no duel-defense proclamation fires for either side.
