## Why

All future work on Triviador will go through OpenSpec's propose/apply/verify/archive workflow, and
that workflow works best against a solution shaped around clear dependency boundaries. Right now
`Triviador.Server` bundles orchestration (`RoomActor`, bots, content loading), infrastructure concerns
(SignalR broadcasting, file-backed repositories), and the ASP.NET Core host itself in one project.
Splitting these into Clean Architecture layers — Domain, Application, Infrastructure, UI — makes the
dependency direction explicit (UI and Infrastructure depend inward on Application and Domain, never the
reverse), gives future OpenSpec changes an unambiguous place to land new code, and prepares for a second
UI project (a mobile app) that must reuse Application/Domain without dragging in ASP.NET Core or SignalR.

## What Changes

- Add `Triviador.Application`: use-case orchestration that depends only on `Triviador.Domain`. Owns the
  room-actor orchestration contract, the port interfaces infrastructure must implement
  (`IRoomBroadcaster`, `IQuestionRepository`, `IMapRepository`, `IAnswerOracle`, `IRoomClock`), and the
  wire-facing DTOs (`PlayerViewDto` and friends) that a UI project projects engine state into.
- Add `Triviador.Infrastructure`: concrete implementations of Application's ports — file-backed
  `QuestionRepository`/`MapRepository` reading `Data/*.json`, and (once SignalR is wired in M1) the
  SignalR-backed `IRoomBroadcaster`. Depends on `Application` and `Domain`.
- Rename `Triviador.Server` to `Triviador.Web`, under a `src/UI/` grouping folder, and narrow it to
  genuine UI/host concerns: `Program.cs`, `GameHub`, `wwwroot`, `appsettings`. It depends on
  `Application` and `Infrastructure` (for DI registration only) and holds no orchestration logic of its
  own. This is the first of two UI projects — `Triviador.Mobile` joins it under `src/UI/` later and must
  be able to depend on the same `Application`/`Domain` pair without referencing `Triviador.Web`.
- Update the solution file, `Directory.Build.props` path assumptions, test project references, and
  `CLAUDE.md`/the implementation plan to reflect the new project names and locations.
- **BREAKING** (internal only, nothing shipped yet): `Triviador.Server` no longer exists as a name;
  anything referencing it (scripts, run configurations, the plan file) must be updated to
  `Triviador.Web`.

## Capabilities

### New Capabilities
(none — no user-facing or spec-level behavior is introduced by this change)

### Modified Capabilities
(none — this is a structural reorganization; the `Ping` round trip built in M0 keeps behaving
identically, just served from a renamed project)

## Impact

- Affected code: `src/Triviador.Server` (renamed/relocated to `src/UI/Triviador.Web`), `Triviador.sln`,
  `tests/Triviador.Server.Tests` (renamed to `tests/Triviador.Web.Tests`, project reference updated).
- New projects: `src/Triviador.Application`, `src/Triviador.Infrastructure`.
- No dependency, API, or runtime-behavior changes — `dotnet build`, `dotnet test`, and the M0 SignalR
  round trip must all still pass after the move, from their new paths.
- Downstream: the approved implementation plan
  (`C:\Users\OleksandrBondarenko\.claude\plans\we-will-create-triviador-cached-flask.md`) and
  `CLAUDE.md` both reference `Triviador.Server` by name and need their paths/commands updated to match.
