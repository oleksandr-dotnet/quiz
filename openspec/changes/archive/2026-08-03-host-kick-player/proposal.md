## Why

There is no way for a host to remove a disruptive or unwanted player from a room. `player-leave-and-
takeover` covers a player *choosing* to leave mid-game (their seat becomes bot-controlled), and
`room-lobby` covers a dropped connection (seat just shows disconnected) — neither gives the host any
power over a seat they don't own. Hosts need a host-initiated removal, in the lobby and mid-game
alike, with an explicit choice of what happens to a removed player's territory when a game is already
running.

## What Changes

- A host-only removal action, triggered by clicking another player and choosing "Kick": in the lobby
  this simply frees the seat (identical to that player leaving voluntarily); once a game has started,
  the host additionally picks what happens to the kicked player's territory — hand it to a bot that
  keeps playing the seat for the rest of the game (reusing `player-leave-and-takeover`'s existing
  seat-to-bot mechanism, just host-triggered against another seat instead of self-triggered), or
  release every region they own to neutral/unowned and remove them from all further turns.
- New domain concept `PlayerState.Withdrawn` and command `WithdrawPlayer`, distinct from `Eliminated`
  (a withdrawn player was removed by the host, not defeated in battle) — releases the player's owned
  regions to neutral and excludes them from all future turn order, base-pick order, and land-grab
  award order, rerouting immediately past them if they currently hold the turn so nobody's fate waits
  on a timeout for a player who will never respond.
- The kicked player's client receives a targeted, single-connection notification and shows a
  localized "You were kicked" takeover screen; they cannot reclaim their old seat afterward (their
  reconnect token is invalidated as part of the kick, for both territory dispositions).

## Capabilities

### New Capabilities
- `host-kick-player`: host-only removal of another seat, from the lobby or mid-game, with a
  mid-game choice between bot takeover and territory release, and the kicked client's own experience.

### Modified Capabilities
(none — `player-leave-and-takeover` and `room-lobby`'s existing requirements are unchanged; this
change reuses `player-leave-and-takeover`'s bot-conversion mechanism internally but does not alter
its own self-leave behavior or requirements)

## Impact

- `Triviador.Domain`: `PlayerState.Withdrawn`; new `WithdrawPlayer` command, `PlayerWithdrawn` event,
  `PlayerAlreadyWithdrawn` rejection code; new `GameEngine.Withdrawal.cs` partial; small edits to
  `GameEngine.LandGrab.cs` (`ActiveParticipants`, `CompleteRegionPick`'s skip logic),
  `GameEngine.BaseSelection.cs` (`NextPlayerForBasePick`'s skip logic), `GameEngine.Battle.cs`
  (`AdvanceTurn`'s skip condition, a defensive guard in `ResolveRevealHold`); `GameState.Fingerprint()`
  and `Projection/SnapshotBuilder.cs`/`GameSnapshot.cs` gain `Withdrawn`.
- `Triviador.Application`: new `KickLandPolicy` enum, `KickPlayerRequest` message,
  `RoomActor.KickPlayerAsync`/`HandleKickPlayerAsync`; `IRoomBroadcaster.SendKickedAsync`;
  `PlayerViewDto.Withdrawn`.
- `src/UI/Triviador.Web`: `GameHub.KickPlayer`; `IGameClient.Kicked`; `SignalRRoomBroadcaster`
  implementation.
- `src/Triviador.Client`: `contracts.ts`/`commands.ts` additions; a player-click action menu and kick
  confirm modal (new components, no generic modal/menu existed before this); a "you were kicked"
  takeover screen; `en.json`/`ru.json` localization keys.
- `tests/e2e`: new `specs/kick-player.spec.ts` covering lobby kick, mid-game bot-takeover kick, and
  mid-game release-land kick.
