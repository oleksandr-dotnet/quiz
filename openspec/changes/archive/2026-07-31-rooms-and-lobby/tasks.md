## 1. Application layer: room orchestration

- [x] 1.1 Add `RoomMessage` (abstract record) with `JoinRequest`, `SetSeatRequest`, `LeaveRequest`,
      `ConnectionLost`, `ShutdownRequest` variants, and `CommandAck`. **Deviation:** no
      `SnapshotRequest`/`Resync` - see task 3.1's note; no generic `CommandMessage` - `SetSeatRequest`/
      `LeaveRequest` are concrete typed messages instead, since there's no `IGameCommand` polymorphic
      hierarchy yet for a generic wrapper to wrap (that's M2's domain concern, not this change's).
- [x] 1.2 Add `RoomViewDto`/`SeatDto` (the standalone lobby DTOs from design.md - not `PlayerViewDto`).
- [x] 1.3 Add port interfaces `IRoomBroadcaster` (`SendViewAsync`/`SendClosedAsync`, per-connection - a
      "send to all" doesn't fit since every viewer's `RoomViewDto` differs) and `IRoomClock` (`UtcNow`).
- [x] 1.4 Add `ConnectionMap` (`connectionId -> (RoomCode, PlayerId)`).
- [x] 1.5 Add `RoomOptions` (idle threshold, max rooms) and `RoomActor`: the `Channel<RoomMessage>` +
      single pump task, seat state (4 slots: open / bot / human, connected flag, host flag), handling
      for create/join/toggle-seat/leave/disconnect, and host reassignment on leave per the spec.
- [x] 1.6 Add `RoomFactory` and `RoomRegistry` (singleton `ConcurrentDictionary<string, RoomActor>`,
      `CreateRoom`/`TryGet`/`Remove`, delegates code generation to `IRoomCodeGenerator`).

## 2. Infrastructure layer: concrete implementations

- [x] 2.1 Add `IRoomCodeGenerator`/`RoomCodeGenerator`: 4 chars from
      `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` via `RandomNumberGenerator`.
- [x] 2.2 Add `SystemClock : IRoomClock`.
- [ ] 2.3 ~~Add the SignalR-backed `IRoomBroadcaster` implementation in Infrastructure~~ **Corrected
      during implementation, see design.md's Decisions update:** `IHubContext<THub>` is generic on the
      concrete Hub type, which lives in `Triviador.Web` - Infrastructure referencing it would mean
      Infrastructure depends on Web, which depends on Infrastructure (a cycle MSBuild rejects outright).
      The implementation moves to `Triviador.Web/Realtime/SignalRRoomBroadcaster.cs` instead; the
      interface stays in Application exactly as designed, so Application/Infrastructure still know
      nothing about SignalR. Tracked as task 3.5 below.
- [x] 2.4 Add `RoomJanitor : BackgroundService`: sweep every 30s, evict rooms with zero connected
      humans past `RoomOptions.IdleThreshold` (default 15 minutes).

## 3. Web host: hub + wiring

- [x] 3.1 Extend `GameHub` with `CreateRoom(displayName, botSeats)`, `JoinRoom(code, displayName,
      token?)`, `SetSeat(seatIndex, isBot)`, `LeaveRoom()`. Each posts into the resolved room's actor
      via `RoomRegistry` and awaits the ack; rejections surface as `HubException`. **Deviation: no
      separate `Resync()`.** A fresh connection (page refresh *or* SignalR's own automatic reconnect)
      never has a `ConnectionMap` entry to resync against - both cases need to rebind via `JoinRoom`
      with the stored token anyway, so one path handles both instead of two. (A server-side-only
      `RoomActor.GetViewAsync` still exists, used internally by `CreateRoom`'s bot-seeding loop below -
      not exposed to clients as a hub method.)
- [x] 3.2 Wire `ConnectionMap` updates into `OnDisconnectedAsync` (binding happens in `CreateRoom`/
      `JoinRoom` on success, not `OnConnectedAsync` - a connection isn't bound to anything until it
      actually joins a room).
- [x] 3.3 Register `RoomRegistry`, `RoomOptions`, `IRoomClock`, `IRoomCodeGenerator`, `IRoomFactory`,
      `IRoomBroadcaster`, `ConnectionMap` (singletons), and `RoomJanitor` (`AddHostedService`) in
      `Program.cs`.
- [x] 3.4 Add the "create room with N bot seats" shortcut used by "Play vs 3 bots" (`CreateRoom` with
      `botSeats: 3`, seats 2-4 pre-toggled to bot).
- [x] 3.5 Add `IGameClient` (`State`/`RoomClosed`) and `SignalRRoomBroadcaster : IRoomBroadcaster` here
      (relocated from Infrastructure - see task 2.3's note).

## 4. Client: landing + lobby

- [x] 4.1 Add `contracts.ts` types mirroring `RoomViewDto`/`SeatDto`.
- [x] 4.2 Add `api/commands.ts` with `createRoom`/`joinRoom`/`setSeat`/`leaveRoom` wrappers (hub method
      names appear only here); extend `connection.ts`'s `State`/`RoomClosed` handlers to feed the store.
- [x] 4.3 Add the Zustand store: `{ status, view, session }`, `sessionStorage` persistence of
      `{ roomCode, playerToken }`, `applyView` (replaces the whole view on every push - no partial
      merge logic needed at this scope).
- [x] 4.4 Add `LandingScreen`: display-name input, create-room button, join-by-code form, "Play vs 3
      bots" button; auto-join from `sessionStorage` on load if a session exists for the room in the
      URL.
- [x] 4.5 Add `LobbyScreen`: room code display, seat list (name/bot-or-human/connected), host-only bot
      toggle buttons, a "Leave room" button.
- [x] 4.6 Wire screen selection in `App.tsx`: no session -> Landing; session present -> Lobby (no
      other phases exist yet). The reconnect/rejoin effect runs on every `status === 'connected'`
      transition (covers page refresh and SignalR's own automatic reconnect with the same code path).

## 5. Manual verification

- [x] 5.1 Ran the full manual script end to end via a real browser (Playwright), across up to 5 tabs:
      creation (code `DSW9` had no ambiguous characters), join (both sides saw the live update),
      host-only bot toggle, refresh-reclaims-seat (no duplicate), disconnect-marks-status (with the
      host then able to bot-fill the disconnected seat, confirming seats aren't occupied-by-a-
      *connected*-human), host-reassign-on-leave (host left, next connected human became host),
      room-full rejection, room-not-found rejection, "Play vs 3 bots" (one-click room with 3 bots),
      and idle-room eviction (`RoomOptions.IdleThreshold` temporarily set to 5s, confirmed
      `RoomJanitor` logged "Evicted idle room" and the code stopped resolving, then reverted).
      **Not driven live:** non-host seat-toggle rejection - the UI correctly never renders that
      control for a non-host, and reaching the module-private SignalR connection from the browser
      console to call it anyway wasn't worth adding debug scaffolding for; verified by code review of
      `RoomActor.HandleSetSeatAsync`'s `RequestingPlayerId != _hostPlayerId` check instead.
      **Noted, not fixed (cosmetic, outside the spec):** the landing screen's name-input prefill reads
      a single `localStorage` key shared by every tab, so the most recently used name "wins" the
      prefill for all tabs. Harmless - it only affects that one text field, never seat/session
      identity (which is correctly per-tab via `sessionStorage`) - but worth knowing about.
- [x] 5.2 `dotnet build` succeeds with zero errors/warnings (all 4 projects).
- [x] 5.3 `cd src/Triviador.Client && npx tsc -b --noEmit` succeeds.
