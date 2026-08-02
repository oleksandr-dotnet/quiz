## Why

Four independent gaps surfaced from playtesting an in-progress game: a player who wants to step away
mid-game has no way to hand their seat off cleanly (today, leaving mid-game desyncs the room from the
engine - see design.md); a contested region and a contested base look almost identical on the map even
though losing a base is existential and losing a region is not; and a base's hit points can only ever
go down, with no way for a cautious player to spend a turn shoring up their own defense instead of
attacking. Bundling these together because the third and fourth both touch the same Battle
target-selection/assault code path, and the first is a prerequisite for the second/third reading
correctly for a bot-controlled former-human seat.

## What Changes

- A player can explicitly leave a game already in progress. Their seat immediately and permanently
  becomes bot-controlled for the rest of that game (reusing the existing bot decision-making from
  `bot-gameplay`), including finishing out any activity they were the current actor for at the moment
  they left. This is distinct from a mere dropped connection, which continues to only mark a seat
  disconnected per the existing `room-lobby` behavior.
- A player may target their own base as an attack target, but only when it is below full hit points.
  Doing so starts a single-question "self-assault": answering correctly heals the base 1 hit point
  (never above the default max); answering incorrectly or timing out changes nothing. This shares the
  existing base-assault question/reveal machinery rather than introducing a parallel one.
- When a duel or a regular base assault targeting an enemy region starts, the map gives the contested
  region a more noticeable "under attack" treatment (stronger animation, a synthesized sound cue) than
  today's subtle pulsing marker.
- When the viewer's own base becomes the target of an assault (by another player - the self-heal case
  above is calm, not alarming), the client presents a distinctly more intense, urgent effect than the
  regular contested-region treatment, reflecting that elimination is now on the line.

## Capabilities

### New Capabilities
- `player-leave-and-takeover`: explicit mid-game leave, immediate and permanent bot takeover of that
  seat, and how this differs from an ordinary dropped connection.

### Modified Capabilities
- `room-lobby`: the existing "seat occupancy locks once the game starts" requirement is amended with
  the one exception this change introduces - an explicit mid-game leave changing a seat's control mode
  from human to bot, distinct from the host-toggle it already forbids.
- `bot-gameplay`: a seat that becomes bot-controlled while it is already the current actor on a
  pending activity gets that activity's bot move scheduled immediately, not just on the next activity
  transition.
- `battle-flow`: a player's own base becomes a legal, opt-in attack target when damaged, resolving as
  a one-question self-heal instead of a duel/assault against another player.
- `client-presentation`: a more intense visual treatment for a contested region in general, and a
  further-escalated one specifically when the viewer's own base is the target of another player's
  assault.
- `client-audio-feedback`: a new sound cue plays when a duel or assault against another player begins
  (not for the calmer self-heal case).

## Impact

- `src/Triviador.Application/Hosting/RoomActor.cs` - `HandleLeaveAsync`/`LeaveAsync` needs a mid-game
  branch (bot takeover) instead of unconditionally clearing the seat; `ScheduleBotMoves` needs to be
  invoked right after the takeover so an in-flight activity for that player is picked up.
- `src/Triviador.Domain/Engine/GameEngine.Battle.cs` - `EligibleAttackTargetsFor` needs a self-base
  carve-out; `ResolveRevealHold`'s `BaseAssault` branch needs a heal path when attacker equals
  defender.
- `src/Triviador.Domain/State/QuestionPurpose.cs`, `GameRules.cs` - a way to represent/tune the
  self-heal case.
- `src/Triviador.Client/src/components/map/RegionShape.tsx`, `WaxSeal.tsx`, `App.css` - new/escalated
  "under attack" animation classes.
- `src/Triviador.Client/src/lib/sound.ts` - a new synthesized "attack started" cue.
- `src/Triviador.Client/src/api/contracts.ts` - hand-mirrors any new/changed DTO fields (e.g. a
  self-heal indicator on `BattleContextView`).
