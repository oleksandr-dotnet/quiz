## Context

Grounded in the current code:

- `Program.cs` (`src/UI/Triviador.Web/Program.cs`) never touches `builder.Logging`; it relies entirely
  on ASP.NET Core's default host logging (Console + Debug + EventSource providers). `appsettings.json`
  and `appsettings.Development.json` both set `Logging:LogLevel:Default = Information` and
  `Microsoft.AspNetCore = Warning` - generous enough that any `LogInformation`/`LogWarning`/
  `LogError` call from a `Triviador.*` type already passes through unfiltered. There is no
  `appsettings.Production.json` and no env-var log-level override in `render.yaml`, so Production
  uses the same values.
- `render.yaml` runs a single Docker `web` service; Render captures stdout/stderr from the container
  by default. The `Dockerfile`'s entrypoint (`sh -c "... dotnet Triviador.Web.dll"`) does not redirect
  output anywhere - console logging already reaches Render's log stream today, for the handful of
  lines that exist.
- **Existing logger wiring**: `RoomActor` (`src/Triviador.Application/Hosting/RoomActor.cs:31,48`)
  already accepts an optional `ILogger<RoomActor>?`, supplied for real by `RoomFactory`
  (`src/Triviador.Application/Hosting/RoomFactory.cs:14,18`, which resolves
  `loggerFactory?.CreateLogger<RoomActor>()` from the DI-registered `ILoggerFactory`) - so it is never
  actually null at runtime, just optional in the constructor signature. `RoomJanitor`
  (`src/Triviador.Infrastructure/Hosting/RoomJanitor.cs:13,32`) and `QuestionDealer`
  (`src/Triviador.Infrastructure/Content/QuestionDealer.cs:97`) already use real, non-optional
  loggers. **`GameHub` (`src/UI/Triviador.Web/Realtime/GameHub.cs`) has no `ILogger` at all** - its
  primary constructor is `(RoomRegistry registry, ConnectionMap connectionMap)`.
- **Where the actual gaps are**: `RoomActor` only logs once, on an unhandled pump fault (`PumpAsync`,
  line 205). None of its ~11 `Handle*Async` methods log anything on a normal join, seat change,
  leave, kick, game start, or in-game command. `GameHub`'s 9 hub methods each follow the same
  `if (!ack.Success) throw new HubException(ack.RejectionReason);` shape with no logging either way.
- **Command result events**: every in-game command (`SelectBase`, `SubmitAnswer`, `PickRegion`,
  `SelectAttackTarget`, and `WithdrawPlayer` inside `HandleKickPlayerAsync`) returns a
  `CommandResult` whose `.Events` is an `ImmutableArray<IGameEvent>` - the same batch already
  scanned by `ExtractLastReveal` for `QuestionResolved`. `PlayerEliminated(PlayerId)`,
  `BaseCaptured(PlayerId AttackerId, PlayerId DefenderId, RegionId BaseRegionId, ...)`, and
  `GameFinished(GameOutcome Outcome)` (`GameOutcome.Winners : ImmutableArray<PlayerId>`) are all
  defined in `src/Triviador.Domain/Events/GameEvents.cs` and already flow through these same result
  batches - nothing new needs producing, only inspecting.

## Goals / Non-Goals

**Goals:**
- A full game session, watched purely through server logs, shows: connections coming and going,
  rooms being created, players joining/leaving/being kicked, games starting, who got eliminated, whose
  base fell, and who won - without attaching a debugger.
- Any command a player submits that gets rejected is visible in the log with its rejection reason,
  even for high-frequency in-game actions, so a "why didn't my click work" report is diagnosable from
  logs alone.
- No new dependency, sink, or configuration surface - this is pure code-level instrumentation using
  what's already present and already correctly captured by Render.

**Non-Goals:**
- No per-question-answered or per-region-picked *success* logging at Information - these happen many
  times per game (once per player per question) and would dominate the log with low-value repetition.
  Only their *rejections* are logged (at Warning), and their high-value downstream consequences
  (elimination, base capture, game end) are logged separately.
- No structured/JSON logging sink, no external log aggregator, no Serilog/Application Insights
  integration - out of scope; plain `ILogger` + Console provider is enough to solve "I see no logs at
  all."
- No change to `Microsoft.AspNetCore` or `Default` log levels in `appsettings.json` - both are already
  permissive enough for everything this proposal adds.
- No logging inside `Triviador.Domain` - the domain layer has zero I/O by design (`CLAUDE.md`); all
  logging here lives in `Triviador.Application`/`Triviador.Web` (UI/Infrastructure-adjacent layers),
  reading the domain's own event stream rather than the domain doing any logging itself.

## Decisions

### `GameHub` gets a required `ILogger<GameHub>`, plus a small `EnsureSuccess` helper
Every hub method already computes a `CommandAck ack` (or equivalent) and does
`if (!ack.Success) throw new HubException(ack.RejectionReason);`. Centralizing this into:

```csharp
private void EnsureSuccess(CommandAck ack, string action)
{
    if (ack.Success) return;
    logger.LogWarning("{Action} rejected for connection {ConnectionId}: {Reason}", action, Context.ConnectionId, ack.RejectionReason);
    throw new HubException(ack.RejectionReason);
}
```
lets every call site (`SetSeat`, `LeaveRoom` has no ack, `KickPlayer`, `StartGame`, `SelectBase`,
`SubmitAnswer`, `PickRegion`, `SelectAttackTarget`) become `EnsureSuccess(ack, nameof(MethodName));`
instead of repeating the `if`/`throw`, and gets the Warning log for free everywhere at once - both a
simplification and the logging addition in one small change.

`CreateRoom` and `JoinRoom` don't return a `CommandAck` (they return `JoinResult`/have their own
failure shape), so they get their own inline `logger.LogWarning(...)` on failure and
`logger.LogInformation(...)` on success, rather than trying to force them through the same helper.

Lobby/meta actions (`SetSeat`, `LeaveRoom`, `KickPlayer`, `StartGame`) additionally get a
`logger.LogInformation(...)` on their success path - these are infrequent (at most a handful of times
per game) and high-value for understanding "what happened in this room." The four high-frequency
in-game actions (`SelectBase`, `SubmitAnswer`, `PickRegion`, `SelectAttackTarget`) only get the
`EnsureSuccess` rejection-path Warning, per the Non-Goals above.

- Alternative considered: log every hub method call unconditionally at Debug (entry/exit), regardless
  of action type. Rejected - `Default: Information` in `appsettings.json` means Debug lines wouldn't
  show up without an explicit level-config change, which is out of scope (see Non-Goals), so this
  would silently do nothing for the stated problem ("I see no logs on my server").

### `RoomActor` logs its own lifecycle plus a shared `LogNotableEvents` scan over command results
Three direct additions: the constructor logs room creation, `HandleShutdownAsync` logs room shutdown
(it currently does neither), and `HandleStartGameAsync`'s success path logs the player count.

For in-game domain events, a small helper:

```csharp
private void LogNotableEvents(ImmutableArray<IGameEvent> events)
{
    foreach (var e in events)
    {
        switch (e)
        {
            case PlayerEliminated pe:
                _logger?.LogInformation("Room {RoomCode}: player {PlayerId} eliminated", RoomCode, pe.PlayerId.Value);
                break;
            case BaseCaptured bc:
                _logger?.LogInformation("Room {RoomCode}: {Attacker} captured {Defender}'s base {Region}",
                    RoomCode, bc.AttackerId.Value, bc.DefenderId.Value, bc.BaseRegionId.Value);
                break;
            case GameFinished gf:
                _logger?.LogInformation("Room {RoomCode}: game finished, winner(s) {Winners}",
                    RoomCode, string.Join(", ", gf.Outcome.Winners.Select(w => w.Value)));
                break;
        }
    }
}
```

called with `result.Events` right after every `_engine.Execute(...)` call whose acceptance is already
checked (`HandleSelectBaseAsync`, `HandleSubmitAnswerAsync`, `HandlePickRegionAsync`,
`HandleSelectAttackTargetAsync`, `HandleKickPlayerAsync`'s `WithdrawPlayer` branch, and
`HandleEngineTimerElapsedAsync`) - one call site addition per method, no restructuring of the
existing accept/reject branching.
- Alternative considered: have `GameHub` inspect events instead, since it already sees `CommandAck`.
  Rejected - `CommandAck` (the DTO `RoomActor` returns to callers) doesn't carry the underlying
  `ImmutableArray<IGameEvent>`, and threading it through would widen a purely internal contract just
  for logging; `RoomActor` already has the events in hand at the point they're produced.
- Alternative considered: log every event type (including `RegionCaptured`, `RoundAdvanced`,
  `QuestionAsked`/`QuestionResolved`). Rejected for this pass - these fire many times per game (once
  per region grabbed, once per round, once per question) and would reintroduce the noise problem the
  Non-Goals section calls out; the three chosen event types are each rare (at most once per
  elimination/capture/game-end) and high-value.

## Risks / Trade-offs

- **[Risk] `LogNotableEvents` needs to be called at every command-result site by hand; a future new
  command handler could forget to call it.** → Accepted - there's no single choke point in
  `RoomActor` that all `_engine.Execute` results already flow through (each `Handle*Async` method
  branches on acceptance independently), so a shared call site would require restructuring beyond
  this proposal's scope. The existing accept/reject pattern is left as-is; only a call is added.
- **[Trade-off] `GameHub`'s `logger` becomes a required constructor parameter, unlike `RoomActor`'s
  optional one.** → Accepted - `GameHub` is only ever constructed by ASP.NET Core's own DI container
  (SignalR hubs aren't manually `new`'d anywhere in this codebase, confirmed by grep), so a required
  parameter is strictly simpler with no downside. `RoomActor`'s logger stays optional as-is (this
  proposal doesn't touch its constructor signature) - it's `RoomFactory` that already always supplies
  a real one via `ILoggerFactory`.

## Migration Plan

No data migration, no config change, no feature flag - this is additive logging-only instrumentation
with zero behavioral change to any command's accept/reject outcome. Ships as a normal code change.

## Open Questions

None outstanding. Scope, exact call sites, and log levels are settled by the Decisions above.
