## Why

The server produces essentially no application-level log output today. `ILogger<T>` is already wired
through DI (`RoomActor`, `RoomJanitor`, `QuestionDealer` all accept a logger), but across the entire
codebase there are only 3 real log call sites, all on rare/exceptional paths (an idle-room eviction
sweep, an unhandled engine fault, a question bag running dry). `GameHub` - the SignalR entry point for
every player action - has no logger at all. A full game session (create room, join, pick bases,
answer questions, battle, win) produces zero application log lines; whatever appears in Render's log
stream today is only ASP.NET Core/Kestrel's own startup output. This isn't a log-level filtering
problem (`Default: Information` is already generous enough) - the logging was simply never added.

## What Changes

- `GameHub` gets an injected `ILogger<GameHub>` and logs SignalR connection lifecycle
  (connect/disconnect) and every hub-level command outcome: room created, room join
  succeeded/failed, seat changed, player left, player kicked, game started, and a rejection (with
  reason) for any command the room actor rejects.
- `RoomActor` logs room lifecycle (created, game started with player count, shutting down) and
  notable in-game domain events surfaced from `GameEngine.Execute` results: a player eliminated, a
  base captured, and the game finishing (with the winner(s)). High-frequency per-question actions
  (submit answer, pick region, select attack target, select base) are not logged at Information to
  avoid flooding the log with one line per question; a rejection of any of these is still visible via
  `GameHub`'s Warning-level rejection log.
- No new logging provider, package, or sink - this uses the existing `Microsoft.Extensions.Logging`
  `ILogger<T>` plumbing already present via ASP.NET Core's default host, writing to the existing
  Console provider that Render already captures from stdout. No `appsettings.json`/`render.yaml`/
  `Dockerfile` changes are needed.

## Capabilities

### New Capabilities
- `server-observability`: the server SHALL log room and player lifecycle events, and notable game
  outcomes, so operators can follow what happened in a game from the server's log output alone,
  without needing a debugger attached.

## Impact

- `src/UI/Triviador.Web/Realtime/GameHub.cs` - inject `ILogger<GameHub>`, add an `OnConnectedAsync`
  override, log connection/room/seat/leave/kick/start-game outcomes, and centralize the existing
  repeated "if not successful, throw HubException" pattern into a small helper that also logs the
  rejection reason at Warning.
- `src/Triviador.Application/Hosting/RoomActor.cs` - log in the constructor (room created), in
  `HandleShutdownAsync` (room shutting down), in `HandleStartGameAsync`'s success path (game started,
  player count), and add a small helper that scans a command result's events for `PlayerEliminated`/
  `BaseCaptured`/`GameFinished` and logs each at Information, called after every `_engine.Execute`
  call whose result events aren't already otherwise inspected for this.
- No changes to `RoomJanitor.cs`, `QuestionDealer.cs`, `RoomFactory.cs`, `RoomRegistry.cs`,
  `appsettings.json`, `render.yaml`, or `Dockerfile` - the existing logger wiring and log level
  configuration are already sufficient for what this proposal adds.
