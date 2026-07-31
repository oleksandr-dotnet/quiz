## Why

M0 proved the dev loop and the SignalR round trip but has no concept of a room, a player, or a seat.
Every later milestone (base selection, land grab, battle) needs somewhere to run — a room that exists
independently of any single browser tab, survives a refresh, and can be joined by up to four players
with bots filling empty seats. M1 builds that foundation with zero gameplay rules attached, so the
concurrency/identity/reconnection model is validated on its own before any game logic depends on it.

## What Changes

- Add server-side room hosting: one `RoomActor` per room (a `Channel<RoomMessage>` plus a single pump
  task — no locks), a `RoomRegistry` that creates rooms and generates 4-character join codes, and a
  `RoomJanitor` background sweep that evicts idle rooms. Lives in `Triviador.Application`
  (`RoomActor`/`RoomRegistry`/`RoomFactory`/`ConnectionMap`) and `Triviador.Infrastructure`
  (`RoomJanitor`, `RoomCodeGenerator`, the SignalR-backed `IRoomBroadcaster`), per the layer boundaries
  the `restructure-clean-architecture` change established.
- Add `GameHub` methods for the pre-game flow: `CreateRoom`, `JoinRoom`, `SetSeat` (toggle a seat
  between a human placeholder and a bot), `LeaveRoom`. Every player gets an opaque per-room
  token on first join so a page refresh reclaims the same seat.
- Add the React landing and lobby screens: create/join a room by code, a seat list showing name, bot/
  human, and connection status, bot-seat toggles (host only), and a "Play vs 3 bots" button that
  creates a room with three bot seats and skips straight to the seat list.
- No gameplay: there is no `StartGame` transition into base selection yet — the lobby is the entire
  scope. A room simply sits with 1-4 seats filled until this change's scope ends.

## Capabilities

### New Capabilities
- `room-lobby`: creating and joining a room by a 4-character code, up to 4 seats each either a
  connected human or a bot, host-only bot-seat toggling, per-room player identity that survives a
  page refresh via a token stored in `sessionStorage`, disconnect/reconnect status per seat, idle-room
  cleanup, and the "Play vs 3 bots" quick-start.

### Modified Capabilities
(none — `room-lobby` is the first behavioral capability; nothing existed to modify)

## Impact

- Affected code: `Triviador.Application` (new: `RoomActor`, `RoomMessage`, `RoomRegistry`,
  `RoomFactory`, `RoomOptions`, `ConnectionMap`, `IRoomBroadcaster`, `IRoomClock`); `Triviador.Infrastructure`
  (new: `RoomJanitor`, `RoomCodeGenerator`, the SignalR `IRoomBroadcaster` implementation);
  `Triviador.Web` (new: `GameHub` methods beyond `Ping`, DTO contracts under `Realtime/Contracts/`);
  `Triviador.Client` (new: `LandingScreen`, `LobbyScreen`, the Zustand store, `sessionStorage` token
  handling, the SignalR connection module beyond the M0 `Ping` proof).
- No persistence, no accounts/auth — rooms are in-memory and die with the process, exactly as the plan
  scopes the MVP.
- No automated tests are added for this change (see `tests/README.md` — E2E/Playwright coverage is
  deferred; this change is verified manually per its `tasks.md`).
