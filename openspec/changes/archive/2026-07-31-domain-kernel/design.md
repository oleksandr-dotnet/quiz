## Context

`Triviador.Domain` is an empty scaffold (`.csproj` only). This change builds the pure-C# rule
engine for the `Lobby` and `BaseSelection` phases, plus the foundational pieces every later phase
(`LandGrab`, `Battle`, base assault — added by future changes) will reuse without modification: the
primitive types, the map/adjacency model, the question model, and — highest priority — the
`AnswerRanker` that land grab, duels, and base assault all share.

This runs concurrently with the in-progress `rooms-and-lobby` change, which builds
`RoomActor`/`GameHub`/the React lobby in `Application`/`Infrastructure`/`Web`/`Client`. The two
changes do not share a file: `rooms-and-lobby`'s lobby is a *room* (seats, connections, bot toggles)
with no game rules attached, while this change's `Lobby` phase is a *game state machine phase* inside
`Triviador.Domain` that a future `StartGame`-wiring change will connect `RoomActor` to. Full
rationale for the layer split lives in `openspec/changes/restructure-clean-architecture/design.md`;
the detailed engine design (pending sub-state machine, pump, ranking kernel, rejection ladder) is
already spelled out in `C:\Users\OleksandrBondarenko\.claude\plans\we-will-create-triviador-cached-flask.md`
under "Domain layer" — this document does not repeat that content, only the decisions specific to
scoping this change to M2's `Lobby`/`BaseSelection` slice.

## Goals / Non-Goals

**Goals:**
- A `Triviador.Domain` that compiles standalone, with zero package references, no async, no I/O, and
  `BannedSymbols.txt` enforced.
- `GameEngine.Execute` fully working for `Lobby` and `BaseSelection`: join/leave/start, base picks
  with the adjacency-distance rule and its relaxation, the pump, the rejection ladder, and the
  `Finished`-or-pending-with-deadline invariant.
- `AnswerRanker` and its supporting types (`AnswerEvaluator`, `TieBreakOrder`) fully built and
  exercised by a scratch harness, even though no phase in this change's scope calls them yet — later
  phases depend on this shape being stable and correct now.
- `MapDescriptor`/`MapValidator`/`AdjacencyIndex` correct and validated against the eventual
  `map.json` shape (structure only — the actual 18-region content file is Infrastructure's concern,
  added when `MapRepository` is built).
- Deterministic replay primitives (`GameSnapshot`/`SnapshotBuilder`) sufficient to fingerprint state
  for the hygiene checks described in the plan's Verification section (same seed + command log →
  same fingerprint), scoped to what `Lobby`/`BaseSelection` state needs.

**Non-Goals:**
- `LandGrab`, `Battle`, base assault, scoring, and their commands/events/pending-activity variants —
  these are M5 in the project plan and land in a future change once this one's foundations exist.
- Any wire-facing type (`PlayerViewDto`, `StateProjector`) — those live in `Triviador.Application`
  and are added by whichever future change wires `RoomActor` to `GameEngine`.
- A `tests/Triviador.Domain.Tests` xUnit project — the repo's current stance (see `tests/README.md`,
  `CLAUDE.md`) is no unit test projects for now; correctness for this change is demonstrated with a
  throwaway `Program.cs`-style scratch harness or a temporary console runner deleted before archiving,
  not a permanent test suite. If that stance changes later, the ~60 test cases the project plan
  already enumerates under "Domain tests" are the checklist to build from.
- Content files (`map.json`, question banks) — `Infrastructure`'s concern, later.

## Decisions

**Scope cut at the phase boundary, not the file boundary.** `GameCommands.cs`/`GameEvents.cs` are
added with only the members `Lobby`/`BaseSelection` need (`JoinGame`, `LeaveGame`, `StartGame`,
`SelectBase`, `TimeoutElapsed`, plus their events). No placeholder `LandGrabQuestionAsked`-style
members are stubbed in ahead of time — a stub invites a future change to build on an unreviewed
shape instead of designing it fresh against the actual `LandGrab` rules. `PendingActivity` is
declared as the `abstract record` hierarchy from the plan (`BasePick`, `Question`, `RegionPicks`,
`TargetSelection`, `RevealHold`) since the type needs to exist as a closed hierarchy for exhaustive
pattern matching in the pump, but only `BasePick`'s handling is implemented in the engine partials
this change adds — the others exist as declared-but-unused-until-M5 record cases, which is fine
because a record case with no engine logic touching it yet cannot itself be wrong.

**Why build `AnswerRanker` now even though nothing in scope calls it.** The project plan calls it
"the highest-leverage code in the project" and mandates building it before any phase logic. Building
it in isolation now, with a scratch harness proving the ranking scenarios in
`specs/answer-ranking/spec.md`, means the three future callers (land grab, duels, base assault) each
get a proven-correct dependency instead of three chances to get the tie-break/tier/penalty ordering
subtly wrong independently.

**Scratch harness instead of a test project.** Given the repo's explicit "no unit test projects for
now" stance, verification for this change is a temporary console entry point (e.g. a `Program.cs` in
a throwaway `tools/` folder, or literally scratch code run via `dotnet run` and then deleted) that
constructs scenarios from the specs and asserts on `GameSnapshot` fingerprints and `CommandResult`
values, printed and manually eyeballed. This is a conscious, documented trade-off, not silent
scope-cutting — the alternative (skip verification of ranking/rejection logic entirely) is worse
given how much later work depends on this being right.

**`IsBase` derivation lives on `RegionState`'s read side, keyed off `GameState.Players`.** Consistent
with the architecture rule already in `CLAUDE.md` — no stored flag, no second source of truth.

**`GamePhase` has only `Lobby`, `BaseSelection`, `Finished` — no premature `LandGrab`/`Battle`
members.** Discovered while implementing `SelectBase`: the pump invariant ("Finished or a pending
activity with a deadline") can't hold at the exact instant the last base is selected, because
`LandGrab` — the phase that would supply the next pending activity — doesn't exist yet in this
change's scope. Adding `LandGrab` to the enum "for later" without any engine logic behind it would
be exactly the kind of unreviewed-shape-in-advance the plan for `PendingActivity` warns against, so
instead the engine leaves `Phase == BaseSelection` with `Pending == null` at that one instant, marked
by a `BaseSelectionCompleted` event. This is now a documented, narrow exception to the invariant (see
`specs/game-setup-rules/spec.md`), not a silent violation — the future `LandGrab` change closes it by
making that same transition produce a real pending activity instead, at which point the exception
clause is deleted along with the code path it described.

## Risks / Trade-offs

- **No permanent regression test for the ranking kernel** → Mitigation: the scratch harness proves
  every scenario in `specs/answer-ranking/spec.md` once, and the harness script itself is kept
  (not deleted) as `openspec/changes/domain-kernel/artifacts/ranking-harness.md`-style notes or
  equivalent, so a future change that adds the deferred `Triviador.Domain.Tests` project can port
  these scenarios directly instead of rediscovering them.
- **`PendingActivity` declares record cases (`RegionPicks`, `TargetSelection`, `RevealHold`) with no
  engine logic yet** → Mitigation: this is a data-shape commitment, not a behavior commitment; if
  `LandGrab`'s actual needs don't match the shape sketched in the project plan, the future change
  that implements `LandGrab` can freely revise these unused cases without touching working code.
- **Building in parallel with `rooms-and-lobby`** → Mitigation: verified no file overlap (different
  projects entirely); the only shared file is `Triviador.sln`, and `Triviador.Domain` is already a
  registered project as of M0, so this change should need no `.sln` edit at all.

## Migration Plan

Not applicable — this is new code with no existing behavior to migrate and no deployed consumers.

## Open Questions

- ~~Whether the scratch verification harness should be kept as a permanent fixture under `tools/` or
  fully deleted before archiving.~~ **Resolved during apply:** neither. It ran as a standalone
  `dotnet new console` project outside the repository (referencing `Triviador.Domain.csproj` by
  path), proved all 38 scenarios across the three specs, and is kept as a record at
  `openspec/changes/domain-kernel/artifacts/verification-harness.md` rather than as a runnable
  project in the tree — consistent with "no test projects yet" while still leaving the scenarios
  portable for whenever `tests/Triviador.Domain.Tests` is added.
