## Why

`Triviador.Domain` is currently an empty scaffold (just the `.csproj`). Every later milestone —
map rendering, land grab, battle, base assault, bots — depends on a deterministic, replayable rule
engine that already exists and is already correct. Building it now, in parallel with the
in-progress `rooms-and-lobby` change (which lives entirely in `Application`/`Infrastructure`/`Web`/
`Client`), lets both tracks land independently: the lobby has somewhere to hand off to once
`StartGame` exists, and the ranking/rules kernel — the highest-leverage, hardest-to-get-right code
in the project — gets built and hardened before any UI depends on its shape.

## What Changes

- Add domain primitives with zero package references and no ambient time/randomness: `Instant`,
  `PlayerId`, `RegionId`, `QuestionId`, `ActivityToken`, `CommandResult`, `RejectionCode`, enforced
  by `BannedSymbols.txt` (blocks `DateTime.Now/UtcNow`, `System.Random`).
- Add injected abstractions `IRandomSource` and `IQuestionSource` — the only way the engine ever
  gets randomness or content, so replay from `(seed, command log)` stays exact.
- Add the map model: `MapDescriptor`, `RegionDescriptor`, `AdjacencyIndex`, `MapValidator` (rejects
  duplicate ids, asymmetric adjacency, disconnected graphs).
- Add the question model: `Question`, `QuestionPrompt` (no answer field — the anti-cheat boundary
  starts at the type level), `AnswerValue`, `QuestionDraw`.
- Add the ranking kernel: `AnswerEvaluator`, `AnswerRanker`, `RankedAnswer`, `TieBreakOrder` — one
  algorithm, shared later by land grab, duels, and base assault. Built and correct before any phase
  logic, per the project's own stated priority.
- Add the state model: `GameState`, `PlayerState`, `RegionState`, `GameRules`, `PendingActivity` (the
  pending sub-state-machine — `BasePick`, `Question`, `RegionPicks`, `TargetSelection`, `RevealHold`),
  `QuestionPurpose`, `GameOutcome`. `IsBase` is derived from `owner.BaseRegion`, never stored.
- Add commands and events (`GameCommands.cs`, `GameEvents.cs`) covering `Lobby` and `BaseSelection`
  phases only — `LandGrab`/`Battle` commands and events are out of scope for this change (M5 in the
  project's milestone plan) and are not added here, including no placeholder members for them.
- Add `GameEngine` plus its `.Lobby` and `.BaseSelection` partials: `Execute(command)` validates
  fully (a rejection leaves state untouched), applies, then pumps until waiting on external input
  again, returning every event in one batch. Rejection precedence follows the fixed ladder documented
  in the project plan. `Finished`/pending-with-deadline invariant asserted in `DEBUG` builds.
- Add the projection primitives `GameSnapshot`/`SnapshotBuilder` needed for deterministic
  fingerprinting (state comparison in tests and future replay), scoped to `Lobby`/`BaseSelection`
  state only.
- Explicitly **not** in scope: `LandGrab`, `Battle`, base assault, scoring, and any wire-facing DTOs
  or `StateProjector` (that lives in `Triviador.Application`, added by a future change once
  `RoomActor` exists to drive it).

## Capabilities

### New Capabilities
- `map-topology`: map descriptor shape and validation rules — unique region ids, symmetric
  adjacency, a fully connected graph, non-empty required fields.
- `answer-ranking`: deterministic ranking of a set of answers to one question by tier, penalty,
  elapsed time, and a pre-fixed tie-break order, producing a strict `1..n` order.
- `game-setup-rules`: the `Lobby` and `BaseSelection` phase rules — join/leave/start legality, seat
  assignment, base-selection legality (adjacency-distance requirement and its relaxation), and the
  rejection precedence/command-result contract that governs every command the engine accepts.

### Modified Capabilities
(none — these are the first behavioral capabilities in `openspec/specs/`)

## Impact

- Affected code: `src/Triviador.Domain` only (new files under `Primitives/`, `Abstractions/`, `Map/`,
  `Questions/`, `Ranking/`, `State/`, `Commands/`, `Events/`, `Engine/`, `Projection/`) plus
  `BannedSymbols.txt`. No changes to `Triviador.Application`, `Triviador.Infrastructure`,
  `Triviador.Web`, or `Triviador.Client` — those are owned by the concurrent `rooms-and-lobby`
  change.
- `Triviador.sln` may need a small diff if `Triviador.Domain` isn't already wired into the build
  (it is, per M0) — no new project is added.
- No test project is added, per the repo's current stance (see `tests/README.md` and `CLAUDE.md`):
  correctness leans on manual verification of a `GameScenario`-style scratch harness for now: an E2E
  Playwright suite is deferred to when there's a full flow worth covering.
- No persistence, no I/O, no async in this layer, matching the existing architecture rules.
