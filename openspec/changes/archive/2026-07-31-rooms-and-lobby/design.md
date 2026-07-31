## Context

See proposal.md - Why. Post-restructure, the layer boundaries are: `Triviador.Application` owns
orchestration and the ports it needs implemented; `Triviador.Infrastructure` implements those ports;
`Triviador.Web` hosts `GameHub` and depends on both. None of the domain engine
(`GameEngine`/`GameState`/commands) exists yet — that's M2 — so this change cannot derive its view
from engine state the way the master plan's later `PlayerViewDto` does. It has to stand alone as
pure room/seat bookkeeping and be superseded or extended once the engine lands.

No automated tests are added for this change - see `tests/README.md` (E2E/Playwright deferred).
Verification here is the manual loop plus a scripted multi-tab check (Migration Plan, below).

## Goals / Non-Goals

**Goals:**
- A room survives independently of any one connection, is joinable by a short code, and holds up to
  4 seats each either a connected human, a disconnected-but-reserved human, or a bot.
- Exactly one logical thread touches a room's state, so two simultaneous `JoinRoom` calls for the last
  open seat can never both succeed.
- A page refresh reclaims a seat instead of losing it or creating a duplicate.

**Non-Goals:**
- No `StartGame`, no phase machine, no engine integration - a room in this change never transitions
  out of "lobby". M4 is where a real game phase first exists.
- No bot *decision-making* - a bot seat in this change is a label with no behavior behind it (there is
  no game running for a bot to play). `BotBrain`/`BotDriver` heuristics are M6.
- No reconnect-driven bot takeover of a disconnected human's turn - there is no turn yet. The
  Disconnection requirement only marks status; M6 adds substitution once gameplay exists.
- No spectating, no joining an in-progress game as a new player (matches the master plan's cuts).

## Decisions

**Room hosting: one `Channel<RoomMessage>` + one pump task per `RoomActor`, not a lock.** Even with
no gameplay, two players can race to take the last open seat, or a host can toggle a seat at the same
instant someone joins it - a lock around hub methods risks the same broadcast-ordering and
timer-interleaving problems the master plan's Server-layer section describes in detail for the
gameplay case. Building the actor now, while the state it guards is simple (4 seat slots, nothing
else), is cheaper than retrofitting it once M4 adds real state.

**`RoomActor` lives in `Triviador.Application`; `RoomJanitor` and `RoomCodeGenerator` live in
`Triviador.Infrastructure`.** Per `restructure-clean-architecture`'s design.md: the actor's pump is
pure orchestration (`Channel<T>`, no framework dependency); the janitor is a
`Microsoft.Extensions.Hosting.BackgroundService`, a hosting-runtime concern.

**Correction found during implementation: the SignalR-backed `IRoomBroadcaster` implementation lives
in `Triviador.Web`, not `Triviador.Infrastructure`.** The original plan for this placement missed a
hard constraint: `IHubContext<THub>` is generic on the concrete `Hub` subclass, and that subclass
(`GameHub`) lives in `Triviador.Web`. Infrastructure referencing it would mean Infrastructure depends
on Web, which already depends on Infrastructure for DI registration - a reference cycle MSBuild
refuses to build, not just a style violation. The interface still lives in Application exactly as
designed (Application and Infrastructure know nothing about SignalR either way); only the one
implementation class's *location* moves. `RoomCodeGenerator`, `SystemClock`, and `RoomJanitor` have no
such constraint and stay in Infrastructure as planned.

**A standalone `RoomViewDto`, not `PlayerViewDto`.** The master plan's `PlayerViewDto` is a projection
*of engine state* (`GameState` -> DTO via `StateProjector`) and doesn't exist until there's an engine
to project. This change's DTO instead comes straight from the room actor's own seat bookkeeping:

```
RoomViewDto(RoomCode, YouPlayerId, YouAreHost, Seats: SeatDto[])
SeatDto(SeatIndex, PlayerId?, DisplayName?, IsBot, IsConnected)
```

*Open flag:* when M4 wires in the domain engine, decide whether `RoomViewDto` is folded into
`PlayerViewDto.Phase == Lobby` or kept as a distinct pre-game type. Not decided now because nothing in
this change's specs, approach, or tasks depends on the answer - it's purely how M4 organizes its own
DTOs. (Recorded in Open Questions.)

**Identity: an opaque per-room token, minted on first join, held in `sessionStorage`.** Same mechanism
the master plan specifies for the full game: `JoinRoom` accepts an optional token; a match reclaims
the existing seat instead of taking a new one. `sessionStorage` (not `localStorage`) is what makes
four browser tabs four independent seats with no incognito juggling - this is exercised constantly
in this change's own manual verification.

**Host is a role on a seat, tracked by the room, reassigned only on explicit `LeaveRoom`.** A mere
disconnect does not move host status (see spec: "Host reassigns when the host leaves" is scoped to
leaving, not disconnecting) - a disconnected host's connection can't invoke hub methods anyway, so
there's no action to gate, and reassigning on every disconnect would make host bounce around on a
flaky connection. On `LeaveRoom`, the next connected human seat in seat order becomes host; if none
remains, the room has no host until one is seated.

**Room codes: 4 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, `RandomNumberGenerator`, retry on
collision.** No `0/1/I/O` - directly satisfies the spec's "no visually ambiguous characters" scenario.
`RoomRegistry` is a singleton `ConcurrentDictionary<string, RoomActor>`; `TryAdd` with regeneration on
collision (astronomically rare at 32^4, but cheap to handle).

**Disconnect bookkeeping via `ConnectionMap`, not `IUserIdProvider`.** A
`ConcurrentDictionary<string /*connectionId*/, (RoomCode, PlayerId)>` populated on join/rebind and
removed on disconnect, exactly as the master plan's Identity section argues: `IUserIdProvider` needs
the stable id before `JoinRoom` has run, which this design doesn't have any earlier source for either.

**Idle cleanup: a single bucket for this change, not the master plan's four-state matrix.** With no
"in progress" state yet, `RoomJanitor` only needs: evict a room with zero connected humans after an
idle threshold (15 minutes, matching the master plan's "Lobby, no game started" tier - the other three
tiers there are keyed on gameplay state this change doesn't have).

**Client: a Zustand store holding `{ status, view: RoomViewDto | null, session }`, and the SignalR
connection extended (not replaced) from the M0 `Ping` module singleton.** Reuses the M0 decision
(module singleton, not a hook, to sidestep React 18 StrictMode double-registration) rather than
revisiting it.

## Risks / Trade-offs

- [Two `JoinRoom` calls race for the last open seat] -> Mitigation: both calls are messages into the
  same room's single-threaded pump; only one can observe "seat still open" and win.
- [A room's join code is guessable via brute force before it's ever shared] -> Mitigation: out of
  scope for the MVP (no rate limiting), same posture the master plan takes; noted here so it isn't
  mistaken for an oversight.
- [Host-reassignment-on-leave logic has an edge case per seat-order tie] -> Mitigation: "next
  connected human seat in seat order" is a total order (seats are 0-3, fixed at creation), so there is
  no tie to resolve.
- [No automated coverage] -> Mitigation: the Migration Plan's manual script below exercises every spec
  scenario at least once; a regression here is caught the next time this change's flow is manually
  re-run (e.g. before M4 starts building on top of it).

## Migration Plan

1. `Triviador.Application`: add `RoomMessage`/`CommandAck`, `RoomActor`, `RoomOptions`, `ConnectionMap`,
   `RoomRegistry`, `RoomFactory`, `IRoomBroadcaster`, `IRoomClock`, `RoomViewDto`/`SeatDto`.
2. `Triviador.Infrastructure`: add `RoomCodeGenerator`, `RoomJanitor` (`BackgroundService`), the
   SignalR-backed `IRoomBroadcaster` implementation, `SystemClock : IRoomClock`.
3. `Triviador.Web`: extend `GameHub` with `CreateRoom`, `JoinRoom`, `SetSeat`, `LeaveRoom` (no
   `Resync` - both a page refresh and SignalR's own automatic reconnect need `JoinRoom`-with-token
   to rebind a fresh connection anyway, so one path covers both instead of two);
   add `ConnectionMap` wiring in `OnConnectedAsync`/`OnDisconnectedAsync`; register the new
   Application/Infrastructure services and `RoomJanitor` in `Program.cs`.
4. `Triviador.Client`: `LandingScreen` (name entry, create/join-by-code, "Play vs 3 bots"),
   `LobbyScreen` (seat list, host-only bot toggles, connection badges, room code display), the
   Zustand store, `sessionStorage` token persistence, screen-derivation in `App.tsx` (no session ->
   Landing; else Lobby - `Finished`/`Game` don't exist yet).
5. Manual verification script (repeat until clean):
   - Create a room in tab 1; confirm a 4-char code with no ambiguous characters.
   - Join from tabs 2-4 by code; confirm all 4 see a consistent, live-updating seat list.
   - Toggle an open seat to bot from the host tab; confirm it appears as a bot in every tab.
   - Attempt a seat toggle from a non-host tab; confirm it's rejected.
   - Refresh tab 2; confirm it reclaims its seat (not a 5th/duplicate seat).
   - Close tab 3 (not refresh); confirm its seat shows disconnected in the other tabs and the room
     keeps working.
   - From the host tab, leave the room; confirm host reassigns to another connected human tab.
   - Open a 5th tab and try to join a full room; confirm a clear "room full" rejection.
   - Try joining a made-up code; confirm a clear "room not found" rejection.
   - Create a room and abandon it (no second join); confirm it stops resolving after the idle
     threshold (acceptable to shorten the threshold via `RoomOptions` for this manual check only).
   - Land on `/`, use "Play vs 3 bots"; confirm one room with 3 bot seats appears immediately.
6. `dotnet build` and a client typecheck (`npx tsc -b --noEmit`) must both stay clean throughout.

**Rollback:** everything here is new files plus additive `GameHub` methods and `Program.cs`
registrations - no existing M0 behavior (`Ping`) is touched, so reverting this change's commit is
unconditionally safe.

## Open Questions

- Whether M4 folds `RoomViewDto` into `PlayerViewDto.Phase == Lobby` or keeps it a distinct type is
  left to M4 - it doesn't change this change's specs, approach, or tasks (see Decisions).
