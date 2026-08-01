## 1. Project hygiene

- [x] 1.1 Add `BannedSymbols.txt` to `Triviador.Domain` banning `DateTime.Now`, `DateTime.UtcNow`,
      `DateTimeOffset.Now`, `DateTimeOffset.UtcNow`, and `System.Random`; wire it into the analyzer
      config the project already expects (per `Directory.Build.props`/`.editorconfig`).
- [x] 1.2 Add folder structure: `Primitives/`, `Abstractions/`, `Map/`, `Questions/`, `Ranking/`,
      `State/`, `Commands/`, `Events/`, `Engine/`, `Projection/`.

## 2. Primitives and abstractions

- [x] 2.1 Add `Instant` (wraps `long UnixMillis`) with `Since(Instant)` returning elapsed duration.
- [x] 2.2 Add `PlayerId` (wraps `Guid`), `RegionId`/`QuestionId` (wrap `string`), `ActivityToken`
      (wraps `int`, monotonic sequence).
- [x] 2.3 Add `RejectionCode` enum covering every code named in `specs/game-setup-rules/spec.md`
      (`GameAlreadyFinished`, `WrongPhase`, `UnknownPlayer`, `NotAwaitingThisInput`,
      `StaleActivityToken`, `NotYourTurn`, `AlreadyAnswered`, `DeadlineNotReached`, plus rule-legality
      codes for start-game-below-minimum and base-selection-distance).
- [x] 2.4 Add `CommandResult` (`IsAccepted`, `RejectionCode?`, `ImmutableArray<IGameEvent> Events`)
      with `Accepted(events)`/`Rejected(code)` factory helpers.
- [x] 2.5 Add `IRandomSource` (seeded draw operations: next int in range, shuffle a sequence) and
      `IQuestionSource` (`Draw(QuestionDraw) -> Question`, synchronous, no side effects).

## 3. Map model

- [x] 3.1 Add `RegionDescriptor` (`RegionId`, point value, render payload) and `MapDescriptor`
      (ordered list of `RegionDescriptor`, adjacency pairs) — canonical iteration order is the
      descriptor's declaration order.
- [x] 3.2 Add `AdjacencyIndex`: built once from a `MapDescriptor`, exposes neighbor lookup and
      hop-distance/within-N-hops queries (BFS internally).
- [x] 3.3 Add `MapValidator`: checks unique ids, allowed point values, symmetric adjacency, and full
      graph connectivity; returns every violation found, not just the first.
- [x] 3.4 Prove every scenario in `specs/map-topology/spec.md` against a small hand-built descriptor
      (valid case, duplicate id, asymmetric pair, disconnected graph) via the scratch harness (see
      task 9).

## 4. Question model

- [x] 4.1 Add `AnswerValue` (choice index or numeric long, `None` for no submission).
- [x] 4.2 Add `QuestionPrompt` (id, kind, text, options-without-answer-marker — no answer field
      exists on this type) and `Question` (adds the answer/correct index, used only after
      resolution).
- [x] 4.3 Add `QuestionDraw` (the request shape passed to `IQuestionSource.Draw`).

## 5. Ranking kernel (build and prove before phase logic)

- [x] 5.1 Add `AnswerEvaluator.Evaluate` implementing the tier/penalty table from
      `specs/answer-ranking/spec.md` for both choice and numeric questions, including the
      no-submission cases.
- [x] 5.2 Add `TieBreakOrder` (a fixed player permutation) with two constructors: a seeded-shuffle
      factory for land grab, and a `Prefer(defender, attacker)` factory for duels/assaults.
- [x] 5.3 Add `RankedAnswer` and `AnswerRanker.Rank`: sorts by `Tier` asc, `Penalty` asc, elapsed asc
      (missing elapsed sorts last), then `TieBreakOrder` index asc; asserts the result is a strict
      `1..n` order.
- [x] 5.4 Prove every scenario in `specs/answer-ranking/spec.md` via the scratch harness: tier
      ordering, penalty ordering, elapsed ordering, tie-break resolution (both shuffle and
      defender-preference variants), and the strict-order guarantee over an all-silent set.

## 6. State model

- [x] 6.1 Add `GameRules` with every tunable named in the project plan that this change's scope
      touches: minimum/maximum player count, `MinimumBaseDistance`, base pick duration,
      `RoundLimit`/`Marathon` preset (declared even though `Battle` doesn't exist yet, since
      `GameRules` is meant to hold every tunable in one place per `CLAUDE.md`).
- [x] 6.2 Add `RegionState` (owner `PlayerId?`, derived `IsBase` computed from the owning player's
      `BaseRegion` — never a stored field).
- [x] 6.3 Add `PlayerState` (`Seat`, `PlayerId`, `BaseRegion`, `Eliminated`, connection-agnostic —
      connection/host concerns stay in `Triviador.Application`).
- [x] 6.4 Add `PendingActivity` as an abstract record hierarchy with sealed cases `BasePick`,
      `Question`, `RegionPicks`, `TargetSelection`, `RevealHold` per the project plan's shape, each
      carrying `(ActivityToken, Instant Deadline)` plus its own fields. Only `BasePick` is driven by
      engine logic in this change; the others are declared for shape stability but unused until a
      future change implements their phases.
- [x] 6.5 Add `QuestionPurpose` abstract record with `LandGrab`/`Duel`/`BaseAssault` cases per the
      project plan (declared, unused until `LandGrab`/`Battle` land).
- [x] 6.6 Add `GameOutcome` (winner id or draw marker) and `GameState` (phase, players, regions, map
      reference, pending activity, `Version`-independent internal state — `Version` stamping is a
      host/`Triviador.Application` concern, not domain).
- [x] 6.7 Add `GameState.Fingerprint()` (or equivalent) producing a deterministic value/hash usable to
      assert two states are equal for the "rejected command leaves state unchanged" and replay
      scenarios.

## 7. Commands and events

- [x] 7.1 Add `GameCommands.cs`: `IGameCommand` marker plus `JoinGame`, `LeaveGame`, `StartGame`,
      `SelectBase`, `TimeoutElapsed` — every command carries `Instant At`; `SelectBase` and
      `TimeoutElapsed` also carry `ActivityToken`.
- [x] 7.2 Add `GameEvents.cs`: `IGameEvent` marker plus the events this scope's phases emit (player
      joined/left, game started, base-pick requested, base selected, base-selection complete /
      phase-transition marker). No answer-leaking fields on any event.

## 8. Engine

- [x] 8.1 Add `GameEngine` core: `Execute(IGameCommand)` entry point, the rejection-precedence
      ladder from `specs/game-setup-rules/spec.md` applied uniformly before any phase-specific
      dispatch, and the pump loop (advance until waiting on external input or `Finished`, buffering
      events, 64-iteration guard that throws past that).
- [x] 8.2 Add `GameEngine.Lobby` partial: `JoinGame`/`LeaveGame` handling (seat assignment in join
      order), `StartGame` legality (minimum player count) and transition into `BaseSelection` with
      the first `BasePick` pending activity.
- [x] 8.3 Add `GameEngine.BaseSelection` partial: `SelectBase` legality (unowned region,
      `MinimumBaseDistance` via `AdjacencyIndex`, with automatic relaxation when no legal region
      remains), seat-order advancement of `BasePick`, and `TimeoutElapsed` handling for a lapsed base
      pick (per `GameRules`' timeout policy — auto-pick or skip, per whatever default `GameRules`
      documents).
- [x] 8.4 Add the `DEBUG`-only invariant assertion: after every `Execute`, `GameState` is `Finished`
      or has a non-null pending activity with a deadline.
- [x] 8.5 Prove every scenario in `specs/game-setup-rules/spec.md` via the scratch harness: rejection
      precedence ordering, stale-token `TimeoutElapsed` no-op, early-timeout rejection, `StartGame`
      below/above minimum, base-distance rejection and its relaxation, seat-order advancement,
      `IsBase` derivation.

## 9. Projection and verification harness

- [x] 9.1 Add `GameSnapshot`/`SnapshotBuilder` sufficient to represent `Lobby`/`BaseSelection` state
      for fingerprinting (no wire DTOs — this is an internal replay/testing primitive only).
- [x] 9.2 Write the scratch verification harness (a throwaway runnable, e.g. under a `tools/`
      folder or a temporary `Program.cs`) that exercises every scenario listed in tasks 3.4, 5.4, and
      8.5, printing pass/fail per scenario.
- [x] 9.3 Run the harness, fix anything it finds, and record in the PR/change notes whether the
      harness is being kept (per design.md's open question) or deleted before archiving.

## 10. Build verification

- [x] 10.1 `dotnet build` succeeds with zero errors/warnings, and confirm no new reference was added
      from `Triviador.Domain` to any other project. The only `PackageReference` is
      `Microsoft.CodeAnalysis.BannedApiAnalyzers` (`PrivateAssets="all"`) for `BannedSymbols.txt` —
      a dev-time analyzer, not a runtime/production dependency, so "zero package references" holds
      in the sense the architecture rule cares about (nothing ships in the compiled output, nothing
      flows to consumers). Pinned to the exact version on nuget.org (`4.14.0`) because this
      environment's default NuGet feed order includes a private mirror that 401s on anything it
      doesn't have cached, which breaks version-range resolution.
- [x] 10.2 Confirm `git status` shows changes only under `src/Triviador.Domain/` and `openspec/` —
      no accidental edits to `Application`/`Infrastructure`/`Web`/`Client` (the concurrent
      `rooms-and-lobby` change's territory).
