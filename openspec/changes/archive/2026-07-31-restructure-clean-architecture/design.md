## Context

See proposal.md - Why. Today the solution has four projects: `Triviador.Domain` (already
dependency-free, matches where Clean Architecture's Domain layer needs to be), `Triviador.Server`
(everything else - ASP.NET Core host, `GameHub`, and, per the approved MVP plan, all of M1's room
orchestration, bots, and content loading once that lands), `Triviador.Client` (the React SPA, not a
.NET project), and two test projects. Only `Program.cs`, `GameHub.cs`, and boilerplate exist in
`Triviador.Server` right now (M0's Ping round trip) - none of the Hosting/Bots/Content code from the
plan has been written yet, which makes this the cheapest possible moment to split the layer boundary
before real orchestration logic accumulates in the wrong project.

## Goals / Non-Goals

**Goals:**
- Introduce `Triviador.Application` and `Triviador.Infrastructure` as real, separately-compiled
  projects with the correct dependency direction, so M1 has an unambiguous place to land `RoomActor`,
  the port interfaces, and their concrete implementations.
- Rename/relocate `Triviador.Server` to `src/UI/Triviador.Web`, narrowed to genuine
  presentation/host concerns, as the first of two sibling UI projects.
- Keep `dotnet build`, `dotnet test`, and the M0 SignalR round trip working from their new paths.

**Non-Goals:**
- Writing any of M1's actual room-hosting code. This change only moves what exists (`Program.cs`,
  `GameHub.cs`) and establishes where new code goes; `RoomActor`, bots, and content loading are still
  M1/M6/M7 work, built directly into the new layout.
- Creating `Triviador.Mobile`. The proposal names it as the second UI project so the `src/UI/` grouping
  and the Application/Domain dependency shape are chosen with it in mind, but it is not created now -
  there is nothing for it to do yet.
- `Triviador.Client` (the React SPA) does not participate in this C# layering at all and is not moved.
  It has no project reference graph to fix; it continues to be built into `Triviador.Web/wwwroot` exactly
  as M0 set up, via the same relative path convention (updated for the new nesting - see Decisions).
- Adding DI wiring ceremony (`AddApplication()`/`AddInfrastructure()` extension methods) with nothing
  behind it yet - see Decisions.

## Decisions

**Layout:**
```
src/
  Triviador.Domain/            (unchanged)
  Triviador.Application/       (new - empty scaffold, real content starts in M1)
  Triviador.Infrastructure/    (new - empty scaffold, real content starts in M1)
  Triviador.Client/            (unchanged - not a .NET project, not moved)
  UI/
    Triviador.Web/             (renamed from Triviador.Server)
tests/
  Triviador.Domain.Tests/      (unchanged)
  Triviador.Application.Tests/ (new - empty scaffold)
  Triviador.Infrastructure.Tests/ (new - empty scaffold)
  Triviador.Web.Tests/         (renamed from Triviador.Server.Tests)
```

**Dependency direction: Domain <- Application <- Infrastructure, and Domain <- Application <- UI.**
`Application` references only `Domain`. `Infrastructure` references `Application` (to implement its
ports) and transitively `Domain`. `Triviador.Web` references `Application` directly (for the
orchestration it calls into) and `Infrastructure` (for DI registration of concrete implementations
only - never called directly from hub/controller code). This is the standard Clean Architecture
arrangement and is what lets a future `Triviador.Mobile` reference `Application`/`Domain` without
ever seeing `Triviador.Web` or SignalR. *Alternative considered:* fold Infrastructure into
Application (skip the extra project) - rejected because the plan's own file-backed
`QuestionRepository`/`MapRepository` and the SignalR-backed `IRoomBroadcaster` are exactly the kind of
swappable, I/O-touching implementations Clean Architecture isolates; keeping them separate is what
makes "swap the content source" or "test Application against a fake broadcaster" cheap later.

**`Triviador.Application` owns the port interfaces and the wire DTOs, not `Triviador.Infrastructure`
or `Triviador.Web`.** `IRoomBroadcaster`, `IRoomClock`, `IAnswerOracle`, `IQuestionRepository`,
`IMapRepository`, and `PlayerViewDto`/`SeatDto`/etc. all live in Application. *Rationale:* these are
the contract between the orchestration logic (Application) and everything that depends on it
(Infrastructure implements the ports; Web/Mobile consume the DTOs); putting them in Infrastructure
would make Application depend outward on its own implementer, and putting them in Web would make them
invisible to `Triviador.Infrastructure` and unreachable from a future `Triviador.Mobile`.

**`RoomActor`/`RoomRegistry`/`RoomFactory`/`ConnectionMap` (M1) belong in Application; `RoomJanitor`
(a `BackgroundService`) and `RoomCodeGenerator` belong in Infrastructure.** The room actor's pump is
pure orchestration over `Channel<T>` and the Domain engine - no framework dependency, so it is
Application by the same test that put Domain's rules in Domain. `RoomJanitor` is a
`Microsoft.Extensions.Hosting.BackgroundService` - a .NET *hosting runtime* concern, not a use case -
so it is Infrastructure, calling into Application's `RoomRegistry` to do its sweep.
*This decision is recorded now, ahead of M1, so the milestone lands directly in the right project
instead of needing a second reshuffle.*

**No `AddApplication()`/`AddInfrastructure()` DI extension methods yet.** There is nothing to register
until M1 adds real services. An empty extension method is ceremony with no behavior behind it -
against the "no half-finished implementations" convention already in place for this project. M1 adds
these methods when it adds the first real registration.

**`Triviador.Application.Tests` and `Triviador.Infrastructure.Tests` are scaffolded now, empty.**
*Alternative considered:* defer creating them until M1 gives them something to test - rejected because
adding a test project is pure structural boilerplate identical to what already exists for Domain/Web,
and doing it once now (while nothing depends on it) is cheaper than doing it as a side-quest inside the
M1 change.

**`Triviador.Client`'s build output path moves with the rename.** `vite.config.ts`'s
`build.outDir` becomes `'../UI/Triviador.Web/wwwroot'` (was `'../Triviador.Server/wwwroot'`), and
`Triviador.Web.csproj`'s `BeforePublish` target's `WorkingDirectory` becomes
`$(MSBuildProjectDirectory)\..\..\Triviador.Client` (one extra `..` for the new `UI/` nesting). No
other client change - the dev proxy still targets `http://localhost:5106` unchanged.

## Risks / Trade-offs

- [Two new always-empty-looking projects until M1 lands] -> Mitigation: each gets a one-line `README.md`
  stating what it's for and pointing at this change, so "empty project" reads as "scaffolded, not
  abandoned" to a future session.
- [Git history for moved files could look like delete+add rather than a rename] -> Mitigation: use
  `git mv` for every relocated file so Git's rename detection keeps history attached.
- [Rider/IDE caches referencing the old `Triviador.Server` project name] -> Mitigation: close and
  reopen the solution after the rename; called out explicitly in tasks.md.

## Migration Plan

1. Create `Triviador.Application`, `Triviador.Infrastructure`, and their two test projects as empty
   class libraries with the reference graph above; add them to `Triviador.sln`.
2. `git mv src/Triviador.Server src/UI/Triviador.Web` and `git mv tests/Triviador.Server.Tests
   tests/Triviador.Web.Tests`; rename the `.csproj` files and the assembly/root namespace inside them
   to match; update `Triviador.sln`'s project entries and paths.
3. Update `Triviador.Web.csproj`: add `ProjectReference`s to `Application` and `Infrastructure`
   (alongside the existing `Domain` reference), fix the `BeforePublish` `WorkingDirectory`.
4. Update `Triviador.Client/vite.config.ts`'s `build.outDir`.
5. Update `.gitignore`'s `wwwroot` path entries, `CLAUDE.md`'s commands/paths, `README.md`'s command,
   and the approved plan file's `Triviador.Server` references, to the new `src/UI/Triviador.Web` path.
6. Verify: `dotnet build`, `dotnet test` (both currently-empty test projects and the two new ones run
   with zero tests found - expected), then redo the M0 manual check (`dotnet watch` from the new path +
   `npm run dev`, confirm Ping still round-trips through the browser).
7. Commit as its own change, separate from any M1 work, so the rename is easy to `git revert` in
   isolation if something downstream breaks.

**Rollback:** a single `git revert` of the migration commit restores `Triviador.Server` at its old
path - nothing in this change touches runtime behavior or persisted data, so revert is unconditionally
safe.

## Open Questions

- What tech the future `Triviador.Mobile` project uses (.NET MAUI vs. something else) is not decided
  and does not need to be - it doesn't change this change's specs, approach, or tasks, since the
  Application/Domain boundary this change establishes is tech-agnostic on the consuming side.
