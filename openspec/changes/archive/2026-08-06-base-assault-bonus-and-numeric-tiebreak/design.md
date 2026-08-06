## Context

Grounded in the current code (see `GameEngine.Battle.cs`, `GameEngine.LandGrab.cs`,
`Ranking/AnswerRanker.cs`, `Ranking/AnswerEvaluator.cs`, `State/QuestionPurpose.cs`,
`State/PlayerState.cs`, `State/GameState.cs`):

- **Score has no persisted component today.** `GameState.ScoreOf` is 100% derived every call: 1000
  for an unconquered own base, else each owned region's map `Value`. There is nowhere to put a
  points adjustment that isn't tied to a region.
- **`AnswerRanker.Rank` sorts `Tier -> Penalty -> Elapsed -> TieBreakOrder`**, identically for land
  grab, duels, and base assaults. `AnswerEvaluator.Evaluate` gives a Choice answer `Tier 0`
  (correct), `1` (wrong), or `2` (no/invalid answer), always `Penalty 0`. A Tip (numeric) answer is
  always `Tier 0` if anything was submitted, with `Penalty` the absolute distance from the correct
  value - so a Tip question is already ranked by closeness-then-time-then-tiebreak with no changes
  needed. The only case that currently reaches *elapsed time* before it should, per the new rule, is
  two Choice answers both at `Tier 0` (both correct).
- **Duel and base-assault resolution both go through `ResolveRevealHold`** (`GameEngine.Battle.cs`),
  reading the already-computed `QuestionResult` off the just-closed `RevealHold`. Effects (region
  transfer, HP loss, chain continuation, turn advance) apply here, never in `ResolveQuestion` itself
  - `ResolveQuestion` only ever starts the `RevealHold`; see the existing `battle-flow` spec's "reveal
  before effects" requirement, which this change must keep intact for the new numeric-tiebreak
  question too.
- **`QuestionKindRequest.Tip` already exists and is wired end to end** (`QuestionDraw`,
  `QuestionDealer.Draw`) - forcing a numeric-only draw needs no new domain-side plumbing, just a call
  site that passes it.
- **`AskBattleQuestion` is the single place a Duel/BaseAssault question gets asked**, and already
  computes participants (`[attacker]` for self-heal, `[attacker, defender]` otherwise) and
  `TieBreakOrder.Prefer(defender, attacker)` generically off whatever `QuestionPurpose` it's given -
  a new purpose variant reuses all of this for free as long as it carries `Attacker`/`Defender`.
- **Bots and the client are already purpose-agnostic where it matters**: `BotChoice.Answer` keys only
  off `QuestionPrompt.Kind`; `ScheduleBotMoves` schedules an answer for every participant of whatever
  `PendingActivity.Question` is current, regardless of `Purpose`. Neither needs to know about a new
  purpose variant to keep working.
- **E2E tests never see the correct answer before it's revealed - by design** (the anti-cheat
  boundary `StateProjector`/`RoomActor.BuildGameView` enforces). Existing specs (`kick-player.spec.ts`)
  route around this by not caring about correctness at all (`answerQuestionIfAsked` always clicks
  `option-0`). Reliably exercising "both combatants answer correctly" needs the test to *know* the
  right answer - achievable without touching any live secret channel by having the test read the same
  `Data/questions/choice/*.json` / `tip/*.json` files the server loads from disk, matching by the
  prompt text already shown on screen (post-shuffle option order is irrelevant - a text match finds
  the right index).

## Goals / Non-Goals

**Goals:**
- Every resolved base-assault question (each hit in a chain, and the one that ends a chain on a tie
  or defender win) moves a new `BaseAssaultScoreBonus` (200) between attacker and defender, added to
  `ScoreOf` alongside territory value.
- A Choice-kind duel or base-assault question where both combatants answer correctly triggers exactly
  one follow-up Tip question to the same two combatants; the closer answer wins; only an equally-close
  (including both exact) numeric tiebreak falls back to elapsed time.
- Both features are covered by real, running-game Playwright E2E tests, runnable against a local dev
  loop or a deployed production URL, plus a manually-triggered GitHub Action for the latter.

**Non-Goals:**
- No change to ordinary duel/assault resolution when tiers already differ (one side right, one
  wrong/silent) - ranking already decides on `Tier` alone with no `Elapsed` consultation.
- No change to land grab's ranking or tie-break (still the seeded-shuffle multi-player order) - the
  new rule is specific to the 1v1 duel/assault shape.
- No change to self-heal (`BaseAssault` where `Attacker == Defender`) - it isn't a competitive
  ranking between two players and keeps its existing single-answer exactness check.
- No new persistence layer, no config-driven `GameRules` overrides added for testability (see the
  E2E strategy decision below for why this isn't needed).
- No change to `RevealOverlay`'s exact-match correctness mark or `ArcheryTargetReveal` - both already
  render a numeric reveal with rank and closeness; nothing about the new tiebreak question needs a
  different rendering, only a headline telling players why a second question appeared.

## Decisions

### The base-assault bonus is per resolved question, not per whole assault turn

"When somebody attacks your territory and you win the battle, you get +200" reads most naturally as
one battle = one resolved question, and the domain already treats each hit in a chain as its own
resolved question (its own `RevealHold`, its own reveal). Applying the bonus at every terminal branch
of `ResolveRevealHold`'s `QuestionPurpose.BaseAssault` case (both the "chain continues" hit and the
"chain ends" tie/defender-win) means a long successful siege pays out repeatedly, which matches
"protecting your territory" as an ongoing thing across a prolonged assault, not a single lump sum.
Applying it only once per whole assault *turn* was considered and rejected: it would need to
distinguish "first hit of a turn" from "later hits of the same chain," adding a counter for no stated
benefit, and would make a long, successfully-defended-until-the-last-question assault pay the
defender nothing for every earlier win in that same chain.

### A new `QuestionPurpose.NumericTiebreak(Original, Attacker, Defender)` wraps the tied question

```csharp
public sealed record NumericTiebreak(QuestionPurpose Original, PlayerId Attacker, PlayerId Defender) : QuestionPurpose;
```

`Original` is the `Duel` or `BaseAssault` purpose whose Choice question just tied on correctness.
Wrapping (rather than adding a "tiebreak in progress" flag to `Duel`/`BaseAssault` directly) means the
wrapped purpose's own fields (region, base region, chain `QuestionIndex`/`DamageDealtThisTurn`) don't
need duplicating, and resolving the tiebreak is a matter of re-dispatching to the same effect-applying
logic the normal path already uses, just fed the tiebreak's `QuestionResult` instead of the original
tied one.

`ResolveQuestion` (`GameEngine.LandGrab.cs`) already special-cases `QuestionPurpose.Duel or
QuestionPurpose.BaseAssault` to defer effects behind a `RevealHold` rather than applying them inline;
`NumericTiebreak` joins that same case (`Duel or BaseAssault or NumericTiebreak`) so the tiebreak
question gets its own reveal too, exactly like every other battle question - the "reveal before
effects" invariant holds for it with no special-casing.

`AskBattleQuestion` gains an optional `QuestionKindRequest` parameter (default `Any`, unchanged for
every existing call site); starting the tiebreak passes `QuestionKindRequest.Tip` explicitly.

### Detecting the trigger condition and applying/resolving it

```csharp
private static bool RequiresNumericTiebreak(QuestionResult result, PlayerId attacker, PlayerId defender)
{
    if (result.Question.Prompt.Kind != QuestionKind.Choice) return false;
    var attackerTier = result.Rankings.First(r => r.Player == attacker).Score.Tier;
    var defenderTier = result.Rankings.First(r => r.Player == defender).Score.Tier;
    return attackerTier == 0 && defenderTier == 0;
}
```

`ResolveRevealHold`'s `Duel` and non-self-heal `BaseAssault` cases both become: if
`RequiresNumericTiebreak(pending.Result, attacker, defender)`, call `AskBattleQuestion` with a
`NumericTiebreak(original, attacker, defender)` purpose and `QuestionKindRequest.Tip`; otherwise apply
the outcome exactly as today. The outcome-applying logic itself is factored out of each case into
`ApplyDuelOutcome(duel, result, at)` / `ApplyBaseAssaultOutcome(assault, result, at)` (pure
refactors of the existing inline bodies, parameterized on which `QuestionResult` to rank instead of
always reading `pending.Result`), so a new `NumericTiebreak` case can call the *same* helpers with the
tiebreak's own result:

```csharp
case QuestionPurpose.NumericTiebreak tiebreak:
    events.AddRange(tiebreak.Original switch
    {
        QuestionPurpose.Duel duel => ApplyDuelOutcome(duel, pending.Result, at),
        QuestionPurpose.BaseAssault assault => ApplyBaseAssaultOutcome(assault, pending.Result, at),
        _ => throw new InvalidOperationException("NumericTiebreak.Original must be Duel or BaseAssault"),
    });
    break;
```

No change to `AnswerRanker`/`AnswerEvaluator` themselves - the tiebreak question is ranked by the
existing generic tier/penalty/elapsed/tie-break order, which for a Tip question already means
"closeness, then time, then defender-favored" - exactly the desired fallback chain. `AttackerWon`/
`BothAnsweredIncorrectly` are reused unchanged (they only read `QuestionResult`, not `QuestionPurpose`).

- Alternative considered: give `AnswerRanker.Rank` itself a "duel mode" parameter that internally
  loops in a second draw. Rejected - `AnswerRanker` is a pure, synchronous ranking function with no
  access to `IQuestionSource` or engine state (`_state.Pending`, `AskBattleQuestion`); teaching it to
  ask a follow-up question would break its purity and its land-grab-shared reuse for no benefit, since
  the orchestration (start a `RevealHold`, wait for the next question, resolve again) is exactly what
  `GameEngine.Battle.cs` already does for every chained assault question.

### The base-assault bonus mutation lives inside `ApplyBaseAssaultOutcome`

```csharp
var attackerWon = !PlayerById(assault.Attacker).Withdrawn && AttackerWon(result, assault.Attacker, assault.Defender);
var bonus = _state.Rules.BaseAssaultScoreBonus;
var (winner, loser) = attackerWon ? (assault.Attacker, assault.Defender) : (assault.Defender, assault.Attacker);
PlayerById(winner).BonusScore += bonus;
PlayerById(loser).BonusScore -= bonus;
events.Add(new BaseAssaultScoreAdjusted(assault.Attacker, assault.Defender, attackerWon ? bonus : -bonus, attackerWon ? -bonus : bonus));
```

placed before the existing HP-loss/capture-or-continue and tie/defender-win branches, both of which
stay otherwise unchanged. A withdrawn attacker still resolves through the `else` (defender-won) path
exactly as it does today for HP purposes, so the bonus follows the same rule for consistency rather
than adding a special case: the withdrawn attacker's forfeited hit counts as the defender's win for
scoring too.

`PlayerState.BonusScore` (`int`, default `0`) is added to `GameState.ScoreOf`'s running total and to
`Fingerprint()`'s per-player field list (same place `BaseHitPoints` already is), so it participates in
round-limit tie-breaking and replay determinism exactly like every other mutable player field.

- Alternative considered: emit only `BaseHitPointsChanged`/existing events and let the client infer
  the bonus purely from a `PlayerView.score` diff. Rejected for the *event* (kept the diff-based
  client derivation anyway, see below, since it's simpler than plumbing a new server push through
  every socket path) - but the domain still needs `BaseAssaultScoreAdjusted` for `LogNotableEvents`
  and for any future consumer that wants the fact even without diffing two views.

### Client picks up the bonus proclamation from the existing view-diff pattern, no new server push required

`useGameTransitions` already derives a `scoreDelta` transition by diffing `PlayerView.score` between
consecutive snapshots - once `ScoreOf` includes `BonusScore`, this fires for free. Deriving a
*specific* "+200 for defending/breaching your base" proclamation (rather than a generic, always-noisy
"score changed" toast) reuses the same snapshot-diff idiom already used for `baseDamaged`/
`baseCaptured`: if the *previous* snapshot had a `pendingReveal` open and `previous.battle?.kind ===
'BaseAssault'` with `attackerPlayerId !== defenderPlayerId` (excludes self-heal), and the *current*
snapshot's reveal has closed (`current.pendingReveal === null`), the assault question that was pending
just resolved. Whether the attacker or defender won it is read off whether a `baseDamaged` or
`baseCaptured` transition fired for that defender in the same batch (attacker won) or neither did
(defender won) - both already computed earlier in the same diffing pass. The bonus amount itself is a
mirrored client-side constant (`BASE_ASSAULT_SCORE_BONUS`, matching the existing
`BASE_HIT_POINTS_DEFAULT` mirror pattern in `lib/gameRules.ts`), not read off the raw score delta,
since a chain-ending base capture folds territory value into the same score delta and would make the
raw number an unreliable read of "was this the bonus."

- Alternative considered: add the bonus amount/winner directly to `BattleContextDto` or a new DTO
  field pushed alongside the reveal. Rejected - `BattleContextDto` is null once the reveal closes (the
  exact moment the proclamation should fire), and every other one-off proclamation
  (`baseFallsProclamation`) already works by diffing two full-snapshot broadcasts rather than a
  dedicated per-event field, so this stays consistent with how the client already learns "what just
  happened" (see `useGameTransitions`'s own doc comment: "the server broadcasts only full snapshots").

### `BattleContextDto`/`BattleContextView` gains `IsTiebreakRound`

```csharp
public sealed record BattleContextDto(
    BattleKindDto Kind, string ContestedRegionId, Guid AttackerPlayerId, Guid DefenderPlayerId,
    int? AssaultQuestionIndex, int? DamageDealtThisTurn, bool IsTiebreakRound);
```

`ToBattleContext` gets a `QuestionPurpose.NumericTiebreak` case that delegates to `Original`'s existing
case and sets the flag:

```csharp
QuestionPurpose.NumericTiebreak tiebreak => ToBattleContext(tiebreak.Original) is { } inner
    ? inner with { IsTiebreakRound = true }
    : null,
```

so attacker/defender/region/assault-progress fields stay exactly what they'd be for the wrapped
purpose - only the flag changes. `BattleScreen.tsx`'s `battleHeadline` gets one new branch (checked
before the existing Duel/BaseAssault branches) for `battle.isTiebreakRound`, with dedicated i18n
copy ("Tied! Closest number wins.") reused for both Duel- and BaseAssault-wrapped tiebreaks since the
mechanic reads identically to a player either way.

### E2E strategy: content-bank lookup for determinism, a minimal two-player game for reachability

Two separate practical problems, two separate answers:

1. **Forcing "both answer correctly" without a testing backdoor.** The test suite reads
   `Data/questions/choice/*.json` (English fields - the suite already pins the client to English via
   `triviador.locale`, which `LandingScreen` forwards as the room's `GameRules.Language` at
   `CreateRoom` time, so served prompt text/options are the English ones) into a `questionText ->
   { options, correctOptionIndex }` lookup, keyed by the exact prompt text. When a Choice question
   appears, the test finds the correct option's *text* in the bank, then finds *that text's current
   index* in the (possibly shuffled) `prompt.options` actually shown, and clicks that `option-{index}`
   for both attacker and defender pages. This uses only public, already-checked-in content the same
   way the server itself does - never a live secret channel - and works unchanged against production,
   since production serves the same `Data/questions` content baked into the same deployed build.
   `Data/questions/tip/*.json` is read the same way for the numeric tiebreak (submit the exact
   `correctNumericValue` from one page to deterministically win the tiebreak on closeness).
2. **Reaching a base assault (round 8+) in bounded real time.** A base-assault question is only
   reachable once `GameRules.BaseAssaultUnlockRound` (8) is reached, and `RevealHold` always waits its
   full `RevealHoldDurationSeconds` (7s) even when both sides answer instantly - there's no way to
   shortcut that without a config-driven `GameRules` override, which is out of scope (see Non-Goals).
   What *is* controllable is how many turns a round takes: a **deliberately minimal two-player game**
   (`GameRules.MinPlayers == 2`, no bots) halves turns-per-round versus the default four-seat game,
   and answering every question the instant it appears (rather than waiting out any deadline) means
   the only unavoidable per-question cost is the 7s reveal. Estimated budget: land grab (~60-90s for
   18 regions across 2 players) + 8 rounds x 2 turns x (~8-10s each, dominated by the fixed reveal) +
   the base-assault question itself - comfortably under 5 minutes, long for a test but not
   impractical, and unlike `RoomOptions.IdleThreshold` (excluded in `room-lobby`'s E2E coverage as a
   genuinely 15-minute wait) this doesn't require any product code change to become testable.

   The base-assault-bonus assertion itself only needs *one* resolved assault question against a
   full-health base (`BaseHitPointsDefault` 5, so a single hit never captures it) - whoever wins,
   `BonusScore` moves by exactly ±200 with no territory transfer to confound the read, so the test
   doesn't need to control (or even know) who wins that particular question, only record both
   players' `PlayerView.score` immediately before the attack and assert the exact ±200 split
   immediately after the reveal closes.

- Alternative considered: add a `GameRules` override read from configuration/environment purely so
  E2E can shrink `BaseAssaultUnlockRound`/`RoundLimit`. Rejected - no such override exists anywhere in
  this codebase today (`RoomOptions.IdleThreshold` is the one precedent, and it's explicitly *not*
  wired to configuration, called out as a deliberate, accepted gap in `tests/e2e/README.md`), and
  adding one would touch real production configuration surface for a testing-only convenience the
  two-player timing budget above already makes unnecessary.

### Running the suite against production

`playwright.config.ts`'s `baseURL` and `webServer` become conditional on a new `E2E_BASE_URL`
environment variable: when set, `baseURL` is that value and `webServer` is omitted entirely (nothing
local to boot or reuse - the target is already running); when unset, behavior is byte-for-byte what it
is today (local dev servers, booted or reused). No test file needs to know or care which mode it's
running in - only `playwright.config.ts` branches. The production URL itself
(`https://quiz-l0e2.onrender.com`, this repo's Render "quiz" service) is passed to the new GitHub
Action as `E2E_BASE_URL` via a workflow input/secret rather than hardcoded into the workflow, so
rotating the URL later doesn't need a code change.

## Risks / Trade-offs

- **[Risk] The base-assault-bonus E2E test takes several minutes even minimized.** -> Accepted: it's a
  manually-triggered/production-verification suite per the user's ask, not a per-commit gate: not
  everything in `tests/e2e` needs to run on every push (this repo's existing `ci.yml` doesn't run the
  Playwright suite at all today), and the CI workflow this change adds is itself manually triggered
  (`workflow_dispatch`), so a multi-minute run is an acceptable, expected cost of exercising real game
  depth rather than a mocked shortcut.
- **[Risk] Reading `Data/questions/*.json` from the test suite couples it to that file layout.** ->
  Accepted: the suite already implicitly depends on the server's real content (it drives the actual
  rendered text), and this dependency is one directory read, isolated to one helper function used only
  by the numeric-tiebreak spec - a content-bank reshape would need a one-line path/shape update there,
  not a rewrite.
- **[Risk] Both new specs are inherently slower/more failure-prone than `room-lobby`'s pure-lobby
  tests (more network round-trips, more real game state).** -> Mitigated by generous
  `test.setTimeout` values (matching the existing precedent in `kick-player.spec.ts`) and by every
  intermediate answer being submitted immediately rather than raced against a deadline, removing
  timing slack as a source of flakiness beyond the one genuinely fixed 7s reveal per question.

## Migration Plan

No data migration (in-memory room state only, per `CLAUDE.md`). `PlayerState.BonusScore` defaults to
`0` for every player, so an in-flight game at deploy time (there are none - Render deploys replace the
process) is not a concern. Deploy as a normal release, same as prior small rules changes in this repo.

## Open Questions

None outstanding. Scope (per-question bonus, Duel+BaseAssault tiebreak trigger, self-heal/land-grab
untouched), the exact code seam (`QuestionPurpose.NumericTiebreak` wrapping), the client derivation
strategy (view-diffing, no new push), and the E2E reachability strategy (content lookup + minimal
two-player game) are all settled by the Decisions above.
