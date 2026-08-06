## 1. Domain: score bonus plumbing

- [x] 1.1 `PlayerState.cs`: add `public int BonusScore { get; internal set; }` (default `0`).
- [x] 1.2 `GameState.cs`: fold `player.BonusScore` into `ScoreOf`'s running total; add it to
      `Fingerprint()`'s per-player field list alongside `BaseHitPoints`.
- [x] 1.3 `GameRules.cs`: add `int BaseAssaultScoreBonus = 200`.

## 2. Domain: `NumericTiebreak` purpose and event

- [x] 2.1 `QuestionPurpose.cs`: add `sealed record NumericTiebreak(QuestionPurpose Original, PlayerId Attacker, PlayerId Defender) : QuestionPurpose`.
- [x] 2.2 `Events/GameEvents.cs`: add `sealed record BaseAssaultScoreAdjusted(PlayerId AttackerId, PlayerId DefenderId, int AttackerDelta, int DefenderDelta) : IGameEvent`.

## 3. Domain: engine wiring

- [x] 3.1 `GameEngine.LandGrab.cs`'s `ResolveQuestion`: extend the `case QuestionPurpose.Duel or QuestionPurpose.BaseAssault:` to also match `QuestionPurpose.NumericTiebreak`, so the tiebreak question gets its own `RevealHold` exactly like every other battle question.
- [x] 3.2 `GameEngine.Battle.cs`'s `AskBattleQuestion`: add an optional `QuestionKindRequest kindRequest = QuestionKindRequest.Any` parameter, passed through to `_questions.Draw`.
- [x] 3.3 Add `private static bool RequiresNumericTiebreak(QuestionResult result, PlayerId attacker, PlayerId defender)`: `false` unless `result.Question.Prompt.Kind == QuestionKind.Choice` and both participants' `Score.Tier == 0`.
- [x] 3.4 Factor the existing `Duel` case body into `private ImmutableArray<IGameEvent> ApplyDuelOutcome(QuestionPurpose.Duel duel, QuestionResult result, Instant at)` (same logic, parameterized on which result to rank).
- [x] 3.5 Factor the existing non-self-heal `BaseAssault` case body into `private ImmutableArray<IGameEvent> ApplyBaseAssaultOutcome(QuestionPurpose.BaseAssault assault, QuestionResult result, Instant at)`, and add the `BaseAssaultScoreBonus` mutation (winner's `BonusScore += bonus`, loser's `-= bonus`, `BaseAssaultScoreAdjusted` event) before the existing HP-loss/capture-or-continue and tie/defender-win branches.
- [x] 3.6 `ResolveRevealHold`: change the `Duel` case and the non-self-heal `BaseAssault` case to call `RequiresNumericTiebreak` first - if true, `AskBattleQuestion` a `NumericTiebreak(original, attacker, defender)` purpose with `QuestionKindRequest.Tip`; otherwise call the matching `Apply*Outcome` helper with `pending.Result`. Self-heal's branch (`Attacker == Defender`) is untouched.
- [x] 3.7 `ResolveRevealHold`: add a `case QuestionPurpose.NumericTiebreak tiebreak:` that dispatches `tiebreak.Original` to `ApplyDuelOutcome`/`ApplyBaseAssaultOutcome` using `pending.Result` (the tiebreak's own resolved result), throwing on any other `Original` shape (unreachable invariant).

## 4. Application: DTOs and projection

- [x] 4.1 `Contracts/GameViewDto.cs`: add `bool IsTiebreakRound` to `BattleContextDto`.
- [x] 4.2 `RoomActor.cs`'s `ToBattleContext`: add a `QuestionPurpose.NumericTiebreak` case delegating to `Original`'s existing case, returning it `with { IsTiebreakRound = true }` (`false` for the two existing cases, explicit in their constructor calls).
- [x] 4.3 `RoomActor.cs`'s `LogNotableEvents`: add a case logging `BaseAssaultScoreAdjusted` at Information level, matching the existing `BaseCaptured`/`PlayerEliminated` style.

## 5. Client: contracts and battle UI

- [x] 5.1 `api/contracts.ts`: add `isTiebreakRound: boolean` to `BattleContextView`.
- [x] 5.2 `lib/gameRules.ts`: add `export const BASE_ASSAULT_SCORE_BONUS = 200` (mirrors `GameRules.BaseAssaultScoreBonus`).
- [x] 5.3 `screens/BattleScreen.tsx`'s `battleHeadline`: add a branch, checked before the existing Duel/BaseAssault branches, for `battle.isTiebreakRound` - one shared tiebreak headline string (works for both a Duel- and a BaseAssault-wrapped tiebreak).
- [x] 5.4 `i18n/resources/en.json` and `ru.json`: add the new tiebreak headline key and the base-assault score-bonus proclamation keys (winner/loser variants), in both languages.

## 6. Client: score-bonus proclamation via existing view-diffing

- [x] 6.1 `hooks/useGameTransitions.ts`: add a `baseAssaultScoreAdjusted` transition kind (`{ kind: 'baseAssaultScoreAdjusted'; winnerPlayerId: string; loserPlayerId: string }`), derived when `previous.pendingReveal !== null && current.pendingReveal === null && previous.battle?.kind === 'BaseAssault' && previous.battle.attackerPlayerId !== previous.battle.defenderPlayerId`: winner is the attacker if a `baseDamaged`/`baseCaptured` transition fired for the defender in the same batch, otherwise the defender.
- [x] 6.2 `App.tsx`: push a proclamation message for `baseAssaultScoreAdjusted` (reusing the existing `proclamationQueue` mechanism, phrased from the *viewer's* perspective - "You gained/lost 200 for defending/breaching your base" style, via i18n).

## 7. Spec text

- [x] 7.1 Confirm the drafted deltas in `specs/answer-ranking/spec.md`, `specs/battle-flow/spec.md`, and `specs/e2e-test-tooling/spec.md` (this change) read correctly against the final code.

## 8. E2E: production-URL support

- [x] 8.1 `tests/e2e/playwright.config.ts`: read `process.env.E2E_BASE_URL`; when set, use it as `baseURL` and omit `webServer` entirely; when unset, keep exactly today's local dev-loop behavior.
- [x] 8.2 `tests/e2e/README.md`: document the `E2E_BASE_URL` mode and the two-new-spec-files' coverage/exclusions.

## 9. E2E: numeric-tiebreak spec (reachable via land grab -> first Battle turn)

- [x] 9.1 Add a `tests/e2e/specs/question-bank.ts` helper that reads `Data/questions/choice/*.json` and `Data/questions/tip/*.json` (via Node `fs`, resolved relative to the repo root) into `{ text -> { options, correctOptionIndex } }` / `{ text -> correctNumericValue }` lookups, English fields only.
- [x] 9.2 Add `tests/e2e/specs/battle-numeric-tiebreak.spec.ts`: two human-controlled tabs, no bots - drive base selection, then land grab (answer immediately, correctness doesn't matter) to completion, into Battle's first `TargetSelection`.
- [x] 9.3 Attack an adjacent enemy region; on each resulting Choice-kind question, look up both combatants' correct option via the bank helper and submit it for both - retry across turns until a Choice question actually appears, since the drawn kind isn't controllable.
- [x] 9.4 Assert `battle.isTiebreakRound` becomes true (via the tiebreak headline text) and a numeric question is asked to the same two participants once both answer correctly.
- [x] 9.5 Assert the closer numeric answer wins (submit the exact `correctNumericValue` from one page, a deliberately distant value from the other, the closer one submitted *slower*) - verified via the reveal's own rank-1 row, not territory/HP (which depend on who's attacker that turn).
- [x] 9.6 Assert the equal-closeness-then-time fallback: repeat with both pages submitting the exact `correctNumericValue`, one page submitting distinctly faster - the faster side wins.
- Passes locally in ~50s (`tests/e2e`: `npx playwright test battle-numeric-tiebreak.spec.ts`).

## 10. E2E: base-assault score-bonus spec (reachable via a minimal two-player game to round 8)

- [x] 10.1 Add `tests/e2e/specs/battle-base-assault-bonus.spec.ts`: exactly two human-controlled tabs, no bots. `test.setTimeout(480_000)`.
- [x] 10.2 Drive base selection, then land grab to completion answering every question immediately (content-agnostic - correctness doesn't matter, only progress).
- [x] 10.3 Drive Battle turns for both players, answering every duel question immediately, until the opponent's base becomes an eligible attack target (implies `GameRules.BaseAssaultUnlockRound` reached AND adjacency) - read the round indicator already surfaced in the UI rather than hardcoding a turn count.
- [x] 10.4 Once eligible, select the opponent's base as the attack target; record both players' `PlayerView.score` immediately before submitting answers to that question. The attacker is made to answer correctly and the defender deliberately wrong (via the content-bank lookup), guaranteeing a decisive, tiebreak-free resolution.
- [x] 10.5 After the reveal closes, assert the attacker's score is exactly `+200` relative to its pre-attack value and the defender's is exactly `-200` - a single hit against a full-health base never captures it, so no territory-value change confounds the read.
- [x] 10.6 Assert the base-assault score-bonus proclamation text appears on the winning page.
- Passes locally in ~2.6min (`tests/e2e`: `npx playwright test battle-base-assault-bonus.spec.ts`).

## 11. GitHub Action: production E2E

- [x] 11.1 Add `.github/workflows/e2e-production.yml`: `workflow_dispatch`-triggered (manually run, with a `base_url` input defaulting to `https://quiz-l0e2.onrender.com`), installs Node + Playwright chromium, runs `npx playwright test` in `tests/e2e` with `E2E_BASE_URL` set from the input, uploads the Playwright HTML report as a build artifact on failure.
- [x] 11.2 Document in `tests/e2e/README.md` how to trigger it (`gh workflow run` or the Actions tab) and that it targets the live Render deployment, not a preview/staging environment.

## 12. Verification

- [x] 12.1 `dotnet build` passes (0 warnings, 0 errors).
- [x] 12.2 `cd src/Triviador.Client && npx tsc -b --noEmit` passes.
- [x] 12.3 `cd tests/e2e && npx playwright test` passes locally against the dev loop - all 18 tests across all 4 spec files, including the two new ones and the pre-existing `room-lobby`/`kick-player` suites. Along the way, a full-suite run surfaced a pre-existing latent flake in `kick-player.spec.ts`'s `answerQuestionIfAsked` (clicking the on-screen numeric keypad's submit button, which `App.css` hides above 901px width - a touch-only affordance never exercised before because a Tip-kind land-grab question hadn't previously been drawn during that test) - fixed alongside this change's own helpers by submitting via Enter instead, since it's the same root cause.
- [ ] 12.4 Manually trigger the new GitHub Action once against production and confirm a green run - **left for the user**: triggering a workflow run against the live production deployment is an externally-visible action outside the scope of unattended execution.
