## 1. GameHub: connection and command logging

- [x] 1.1 Add `ILogger<GameHub> logger` to `GameHub`'s primary constructor.
- [x] 1.2 Add an `EnsureSuccess(CommandAck ack, string action)` private helper that logs
      `LogWarning("{Action} rejected for connection {ConnectionId}: {Reason}", ...)` and throws
      `HubException(ack.RejectionReason)` when `!ack.Success`.
- [x] 1.3 Replace the repeated `if (!ack.Success) throw new HubException(ack.RejectionReason);` blocks
      in `SetSeat`, `KickPlayer`, `StartGame`, `SelectBase`, `SubmitAnswer`, `PickRegion`,
      `SelectAttackTarget` with `EnsureSuccess(ack, nameof(<Method>));`.
- [x] 1.4 Add `logger.LogInformation(...)` on the success path of `SetSeat`, `LeaveRoom`,
      `KickPlayer`, and `StartGame` (room code, player id, and the action-specific detail - seat
      index/kind, target player id, etc.). Do not add success-path Information logging to
      `SelectBase`, `SubmitAnswer`, `PickRegion`, `SelectAttackTarget` (high-frequency, rejection-only
      per design.md).
- [x] 1.5 In `CreateRoom`, log `LogWarning` on the host-join failure path and `LogInformation` (room
      code, player id, display name, bot seat count, language) right before the successful return.
- [x] 1.6 In `JoinRoom`, log `LogWarning` on both failure paths (room not found, join rejected) and
      `LogInformation` (player id, display name, room code) right before the successful return.
- [x] 1.7 Add an `OnConnectedAsync` override logging `LogInformation("Connection {ConnectionId}
      connected", ...)`, and add a matching `LogInformation("Connection {ConnectionId}
      disconnected", ...)` line in the existing `OnDisconnectedAsync` override.
- [x] 1.8 In `ResolveConnection`, log `LogWarning` for both failure branches (`NotInRoom`,
      `RoomNotFound`) before throwing.

## 2. RoomActor: room lifecycle and notable event logging

- [x] 2.1 Log `_logger?.LogInformation("Room {RoomCode} created", RoomCode)` at the end of the
      constructor.
- [x] 2.2 Log `_logger?.LogInformation("Room {RoomCode} shutting down", RoomCode)` at the start of
      `HandleShutdownAsync`.
- [x] 2.3 Log `_logger?.LogInformation("Room {RoomCode} started with {PlayerCount} players", ...)` in
      `HandleStartGameAsync`'s success path (after `_engine = engine;`, before returning `Ok`).
- [x] 2.4 Add a private `LogNotableEvents(ImmutableArray<IGameEvent> events)` helper that switches on
      `PlayerEliminated`, `BaseCaptured`, and `GameFinished` and logs each at Information (room code
      plus the relevant player/region/winner ids), as specified in design.md.
- [x] 2.5 Call `LogNotableEvents(result.Events)` after the accepted-result branch in
      `HandleSelectBaseAsync`, `HandleSubmitAnswerAsync`, `HandlePickRegionAsync`,
      `HandleSelectAttackTargetAsync`, `HandleKickPlayerAsync`'s `WithdrawPlayer` branch, and
      `HandleEngineTimerElapsedAsync`.

## 3. Verification

- [x] 3.1 `dotnet build` passes (0 warnings, 0 errors).
- [x] 3.2 Verified by code trace: `CommandAck.Success`/`RejectionReason`
      (`src/Triviador.Application/Hosting/RoomMessage.cs:63`), `PlayerEliminated.PlayerId`,
      `BaseCaptured.AttackerId`/`DefenderId`/`BaseRegionId`, `GameFinished.Outcome` and
      `GameOutcome.Winners` (`src/Triviador.Domain/Events/GameEvents.cs`) all match the properties
      referenced in the new log calls - confirmed by a clean `dotnet build` with no errors, which
      would have failed on any typo'd property/field name.
- [x] 3.3 No e2e/Playwright test added, per instruction - verification is build + code trace only.
