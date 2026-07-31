# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Triviador: a browser multiplayer quiz-conquest game. 2-4 players join a room by code (bots fill
empty seats), pick bases on an 18-territory map, grab land by answering trivia questions, then
battle each other for territory and assault each other's bases until a winner emerges.

The full rules, architecture rationale, and milestone plan live in
`C:\Users\OleksandrBondarenko\.claude\plans\we-will-create-triviador-cached-flask.md`. Read it before
making structural changes — this file only covers what a session needs to get productive quickly.

## Commands

```powershell
# build everything
dotnet build

# run all tests
dotnet test

# run only domain tests (pure C#, fast, no server involved)
dotnet test tests/Triviador.Domain.Tests

# run a single test
dotnet test tests/Triviador.Domain.Tests --filter "FullyQualifiedName~LandGrabTests.First_place_receives_two_picks"

# dev loop: two terminals, always browse the Vite port (5173), never 5106 directly
dotnet watch --project src/Triviador.Server/Triviador.Server.csproj run
cd src/Triviador.Client; npm install; npm run dev

# client typecheck (no test runner configured for the client yet)
cd src/Triviador.Client; npx tsc -b --noEmit

# production sanity check (client build + single-folder publish)
dotnet publish src/Triviador.Server/Triviador.Server.csproj -c Release -o artifacts/publish
artifacts/publish/Triviador.Server.exe   # browse http://localhost:5000
```

In Rider: a **Compound** run configuration combining the server's launch profile and the client's
`npm run dev` starts both with one button.

Four seats for manual testing: open four tabs in one ordinary browser window — the player token
lives in `sessionStorage`, so tabs are independent seats with no incognito juggling needed — or use
the "Play vs 3 bots" button once it exists (M1).

## Architecture

Three strictly separated layers. **The server is the only thing that knows the rules** — the client
renders server-sent state and sends input, and never re-derives game logic:

- **`src/Triviador.Domain`** — pure C#. Game state, rules, the phase state machine. Zero package
  references, no async, no I/O, no logging, no ambient time or randomness (`DateTime.Now/UtcNow` and
  `System.Random` are blocked by `BannedSymbols.txt`). Every command carries `Instant At`, stamped by
  the host; every random draw goes through an injected `IRandomSource` seeded per room. This is what
  makes a whole game replayable from `(seed, command log)` and testable without mocking time.

- **`src/Triviador.Server`** — ASP.NET Core host. One `RoomActor` per game room: a `Channel<RoomMessage>`
  plus a single pump task, so engine state is touched by exactly one logical thread and needs no locks.
  SignalR (`GameHub` at `/hub/game`) pushes a full per-player snapshot on every applied command;
  `StateProjector` is the **only** function allowed to read engine state, and it takes a viewer id —
  this is the anti-cheat boundary (correct answers, other players' in-flight answers, and the question
  deck must never reach a browser that shouldn't see them). Bots live here, not in the domain, and
  consume the exact same per-player projection a human client does.

- **`src/Triviador.Client`** — Vite + React + TypeScript. Renders `PlayerViewDto` snapshots; holds no
  game rules and no reducer (a client-side reducer would be a second, untested implementation of the
  rules). State lives in one Zustand store; the SignalR connection is a module singleton (not a hook —
  React 18 StrictMode double-mounts effects in dev, which would double-register hub handlers).

### The engine's command/event cycle

`GameEngine.Execute(command)` validates fully (a rejection leaves state completely untouched), applies
the command, then **pumps**: it keeps advancing the state machine until it's waiting on external input
again, returning every event generated along the way in one batch. After every `Execute`, the game is
either `Finished` or has a non-null `PendingActivity` with a token and a deadline — this invariant is
asserted in `DEBUG` builds.

Timeouts: the engine publishes a deadline on the pending activity; the host arms a timer and posts
`TimeoutElapsed(token, now)` when it fires. **A `TimeoutElapsed` with a stale token is `Ok` with zero
events, never an exception or a rejection** — late fires, duplicate fires, and races with a
just-in-time answer are all supposed to be harmless. Don't "fix" a stale-token no-op; it's load-bearing.

Rejections are `CommandResult` return values (`RejectionCode`), never exceptions — `GameEngine.Execute`
only throws on a broken invariant (i.e. an engine bug). The room pump uses that split directly: a
rejection fails the caller's ack, an exception faults and closes the room.

### Ranking is the shared kernel

`AnswerRanker` (in `Triviador.Domain/Ranking`) is used by land grab, regular duels, and base assaults —
it is the highest-leverage code in the domain and should be touched with the most care. Ties are
resolved by a `TieBreakOrder` fixed at question-ask time and stored in state (so replay reproduces the
same winner): shuffled by seed for land grab, `[defender, attacker]` for duels/assaults so **the
defender wins any surviving tie**.

## Conventions specific to this repo

- **Canonical iteration order matters for determinism.** Regions iterate in `MapDescriptor.Regions`
  declaration order, players in `PlayerState.Seat` order. Never iterate a `Dictionary` when the order
  could affect game state or a replay will diverge.
- **`IsBase` is derived**, never stored as a flag on `RegionState` — it's read from
  `owner.BaseRegion == region.Id`. A stored flag would be a second source of truth that drifts the
  first time a base is captured.
- **Every domain event must be safe to broadcast verbatim.** `QuestionAsked` carries a `QuestionPrompt`
  (a type with no answer field — not a `Question` with the answer stripped at call sites) so there is
  no code path where the host can leak the answer early.
- **`GameRules` owns every tunable** (round limit, time limits, adjacency requirements, land-grab pick
  counts, base HP, timeout policies). If a rule feels wrong during play-testing, it should be a
  one-line default change on `GameRules` plus a test, not a hardcoded constant somewhere in the engine.
- **The TypeScript DTO mirror in `src/api/contracts.ts` is hand-written**, not generated. Keep it in
  sync by hand when a C# DTO in `Realtime/Contracts/` changes shape; a wire-contract test on the server
  side catches renamed/removed properties (see the plan, §Verification) but not additions.
- **Never add a clock, `Guid.NewGuid()`, or `System.Random` inside `Triviador.Domain`.** If a phase
  algorithm seems to need one, it needs a parameter instead — the host supplies it via the command or
  the injected `IRandomSource`/`IQuestionSource`.
