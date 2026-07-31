## Context

See proposal.md - Why. The concrete API surface this change integrates against (read directly from
`Triviador.Domain`, not from any design doc, since this code already exists and is not being changed
here):

- `GameState.CreateLobby(MapDescriptor, GameRules)` is the only way to construct a game; `GameEngine`
  takes that `GameState` via a public constructor. There is no rehydration path - a room's engine lives
  only in `RoomActor`'s memory, matching the rest of the MVP's "no persistence" stance.
- Commands: `JoinGame(Instant, PlayerId)`, `LeaveGame(Instant, PlayerId)`, `StartGame(Instant)`,
  `SelectBase(Instant, PlayerId, ActivityToken, RegionId)`, `TimeoutElapsed(Instant, ActivityToken)`.
  `Execute` returns `CommandResult(bool IsAccepted, RejectionCode? Rejection, ImmutableArray<IGameEvent> Events)`.
- `GamePhase` is only `{ Lobby, BaseSelection, Finished }`. After the last base is picked,
  `Phase` stays `BaseSelection` with `Pending == null` - a documented stub, not a bug. There is no
  command that moves the game past this point; this change does not add one.
- `PendingActivity.BasePick(Token, Deadline, Player)` is the only pending-activity subtype the engine
  actually produces today; its `Token`/`Deadline` live on the abstract base type.
- `MapDescriptor(string Id, ImmutableArray<RegionDescriptor> Regions)`,
  `RegionDescriptor(RegionId Id, int Value, string RenderPath, ImmutableArray<RegionId> AdjacentTo)` -
  geometry (`RenderPath`, an SVG path string) is part of the Domain region model in this codebase, not
  split out to a client-only type the way an earlier draft of the project plan assumed. This change
  works with that as given.
- No `MapDescriptor` data exists anywhere in the repo yet - this change must supply the first one.
- No `IRandomSource`/`IQuestionSource` implementation exists yet - not needed here, since base
  selection's auto-pick is deterministic (`PickAutoBaseRegion`, not randomness) and nothing here asks a
  question.
- `SnapshotBuilder.Build(GameState)` returns one global, non-viewer-aware `GameSnapshot`. The
  `domain-kernel` proposal explicitly deferred per-viewer redaction to an Application-side projection -
  this change adds that projection (see Decisions).

## Goals / Non-Goals

**Goals:**
- A host can start a game once ≥2 seats are filled; every occupied seat (bot or human) then picks a
  base on a real map, turn by turn, with unresponsive turns (bots, disconnects) resolving on their own.
- Every player sees the same live view of whose turn it is, the countdown, and map ownership.

**Non-Goals:**
- No `LandGrab`/battle/scoring - the engine doesn't have it yet, and this change does not add engine
  code. Once every base is picked, the client shows a clear "done, more coming" state and stops there.
- No bot decision-making code (`BotBrain`/`BotDriver`, M6) - the engine's own timeout auto-pick is a
  complete, correct behavior for this phase on its own, not a stand-in for one.
- No map authoring polish (real geography, hand-drawn regions) - a simple, valid, connected grid is the
  goal; visual polish is out of scope and was never this change's job.
- No persistence/rehydration of a started game across a server restart - matches the rest of the MVP.

## Decisions

**The map: an 18-region, 6x3 grid, `Data/map.json` under `Triviador.Web`, read by a new
`Triviador.Infrastructure.MapRepository`.** Von Neumann adjacency (up/down/left/right neighbors) makes
the graph trivially connected and symmetric - `MapValidator` needs both. Region ids `r01`..`r18` in
row-major order; the middle row (6 regions) is valued 400, top/bottom rows (12 regions) valued 200, so
both allowed values are represented. `RenderPath` is a simple rectangle per cell in a `600x300`
viewBox - a client can render *something* today; a prettier map is a separate, later concern and
isn't blocked by this shape (`MapDescriptor`'s only constraint is "some connected, valid graph").
`MapRepository` resolves the file via `IHostEnvironment.ContentRootPath` (already available -
`Triviador.Infrastructure` references `Microsoft.Extensions.Hosting.Abstractions` for `RoomJanitor`),
validates it with `MapValidator` at startup, and throws (killing the process) if it's invalid -
matching the project's "bad content breaks the build/startup, not the demo" convention.

**One fixed map for the whole server, not a per-room choice.** There is exactly one `MapDescriptor` in
the MVP; `MapRepository` exposes `GetDefaultMap()` returning it, loaded once and cached. Multiple maps
are a real feature (see the master plan) but nothing here needs one yet - adding a second map later is
additive, not a rework of this shape.

**`RoomActor` owns a `GameEngine` once the game starts; bot seats get a `PlayerId` exactly like human
seats.** On `StartGame`, `RoomActor` walks its 4 seats in seat order; every occupied seat (bot or
human) that doesn't yet have a `Guid` identity gets one assigned (bots have never needed one before
now - human seats already have one from joining). Each occupied seat's `Guid` becomes a `PlayerId`
via `JoinGame`, then a `Domain.StartGame` command is sent. *Rationale:* the engine has no concept of
"bot" at all - from its perspective every seat is just a `PlayerId` that either sends `SelectBase` or
doesn't before the deadline. Piggybacking on that uniformity is what makes "no bot code in this
change" true rather than aspirational.

**Bots and disconnected humans need zero special-case code - only a timer.** `RoomActor` arms one timer
per room against `GameEngine.State.Pending.Deadline` after every command; on expiry it posts
`TimeoutElapsed(now, token)`. A bot seat never sends `SelectBase`, so its turn always resolves this
way; a disconnected human's turn resolves identically. The engine's own stale-token handling (from
`domain-kernel`) makes a timer that fires after the activity already resolved a harmless no-op, so
there's no race to guard against on the hosting side. *Alternative considered:* write a trivial
"bot always picks region N" driver now - rejected because it would be dead code once the timeout
covers the same case for free, and M6 is where a *real* bot policy belongs, not a throwaway one here.

**The viewer-aware projection (`GameViewDto`) is new, in `Triviador.Application`, built directly from
`GameState` - not from `GameSnapshot`.** `GameSnapshot`/`SnapshotBuilder` are Domain-internal
fingerprinting/diagnostic tools (their own doc comment says so), not a wire contract. `GameViewDto`
takes a `GameState` and a viewer's `PlayerId` and produces exactly what that viewer should see. For
Lobby/BaseSelection specifically there is nothing to redact (per `domain-kernel`'s own note - no
hidden hands or answers exist in these phases), so today this projection is a straightforward mapping;
its job is establishing *where* that mapping lives (Application, viewer-parameterized) so later phases
that do have secrets extend the same function instead of inventing a second one.

```
GameViewDto(Phase, Regions: RegionViewDto[], Players: PlayerViewDto[],
            CurrentPickerPlayerId?, DeadlineUtc?, YouPlayerId, YouAreCurrentPicker,
            BaseSelectionComplete: bool)
RegionViewDto(RegionId, Value, RenderPath, OwnerPlayerId?, IsBase)
PlayerViewDto(PlayerId, Seat, DisplayName?, IsBot, BaseRegionId?)
```

`BaseSelectionComplete` is computed as `Phase == BaseSelection && Pending == null && Players.All(p => p.BaseRegion != null)`
- the client-visible signal for the Non-Goal above ("done, more coming" rather than looking stuck).

**No client-side "eligible regions" computation; the server is the only source of legality.** The
client renders every unowned region as clickable during the viewer's own turn and relies on the
server's rejection (`BaseTooCloseToExistingBase`, `NotYourTurn`, etc.) surfaced as a visible inline
message on failure. *Alternative considered:* build a second `AdjacencyIndex` in `Triviador.Application`
to precompute a "you can pick these" hint list - rejected for this change as unnecessary duplication of
a rule that already lives correctly in `GameEngine.BaseSelection.cs`; a hint list is a UX nicety worth
revisiting once real playtesting says the extra clicks are annoying, not a correctness requirement.

**`GameHub.StartGame()`/`SelectBase(regionId)` reuse the existing ack-and-broadcast pattern from
`rooms-and-lobby` - no new plumbing shape.** Both post into `RoomActor`'s existing single mailbox;
rejections surface as `HubException`, matching `SetSeat`'s existing precedent. The per-player
`GameViewDto` is pushed via a new `IGameClient.GameState(GameViewDto)` method (kept separate from the
lobby's existing `State(RoomViewDto)` push, since the two DTOs mean different things at different
times and conflating them would force every client handler to type-discriminate a union).

## Risks / Trade-offs

- [The grid map's `RenderPath` rectangles are visually plain] -> Mitigation: explicitly a Non-Goal;
  `MapDescriptor`'s shape doesn't change when someone later swaps in nicer paths, only the JSON does.
- [`RoomActor` now holds meaningfully more state per room (an engine instance, a second timer)] ->
  Mitigation: it's still one actor, one mailbox, one pump - the existing concurrency model absorbs this
  without a new synchronization primitive.
- [A room's game state is lost on server restart, same as the lobby] -> Mitigation: explicitly out of
  scope, consistent with the rest of the MVP; noted here so it isn't mistaken for an oversight later.
- [Every `SelectBase` click during another player's turn round-trips to the server only to be
  rejected] -> Mitigation: acceptable per the "no client-side legality" decision above; the UI still
  disables the click target for non-current-pickers so this is a defense-in-depth path, not the common
  case.

## Migration Plan

1. `Data/map.json` (18 regions, grid layout, per Decisions) under `Triviador.Web/Data/`.
2. `Triviador.Infrastructure`: `IMapRepository`/`MapRepository` (interface in `Triviador.Application`,
   per the established port-ownership rule), validated at startup via `MapValidator`.
3. `Triviador.Application`: `GameViewDto`/`RegionViewDto`/`PlayerViewDto`; extend `RoomActor` with
   engine ownership, `StartGameRequest`/`SelectBaseRequest` mailbox messages, the post-command timer
   arm/fire cycle, and a `GameViewRequest` (server-side view lookup, mirroring `ViewRequest`'s pattern
   from `rooms-and-lobby`).
4. `Triviador.Web`: `IGameClient.GameState(GameViewDto)`; `GameHub.StartGame()`/`SelectBase(regionId)`;
   register `IMapRepository` in `Program.cs`.
5. `Triviador.Client`: `contracts.ts` additions; `commands.ts` additions (`startGame`, `selectBase`);
   `BaseSelectionScreen` (map render from `renderPath`, turn/deadline banner, click-to-pick, inline
   rejection message, "base selection complete" end state); lobby's "Start Game" button (host-only,
   disabled under 2 occupied seats); screen selection in `App.tsx` extended for the new phase.
6. Manual verification (repeat until clean, per the project's current no-automated-tests-yet stance):
   - Start a 2-human room; confirm turn order follows seat order and the map updates live for both.
   - Attempt to pick out of turn; confirm rejection, no state change.
   - Attempt to pick a region too close to an existing base; confirm rejection with a visible reason.
   - "Play vs 3 bots", start the game; confirm every bot seat's turn resolves on its own via timeout
     with no player action, in seat order, without the human player doing anything for those turns.
   - Disconnect the current human picker mid-turn (close the tab); confirm their turn also resolves via
     timeout, identically to a bot.
   - Let base selection run to completion; confirm every player sees a clear "base selection complete"
     state rather than an apparently-stuck screen.
   - Attempt to start a game with only 1 seat occupied; confirm rejection, room stays in the lobby.
7. `dotnet build` and `npx tsc -b --noEmit` clean throughout.

**Rollback:** additive to `RoomActor`/`GameHub`/client and new files elsewhere; no change to
`rooms-and-lobby`'s existing lobby-only behavior when a game hasn't started, so reverting this change's
commit leaves the lobby working exactly as it does today.

## Open Questions

- Whether a future map needs per-map `GameRules` (e.g. a bigger map wanting a longer
  `MinimumBaseDistance`) isn't decided and doesn't need to be - `GetDefaultMap()` returning a single
  fixed map today doesn't foreclose that; it's a parameter to add if/when a second map exists.
