## Why

`rooms-and-lobby` deliberately stopped at the lobby, and the concurrent `domain-kernel` change built a
real `GameEngine` through `Lobby` → `BaseSelection` but stopped at the Domain boundary on purpose,
naming exactly this hand-off as future work: "the lobby has somewhere to hand off to once `StartGame`
exists" and "`StateProjector`... added by a future change once `RoomActor` exists to drive it." This
change is that hand-off: once two or more seats are filled, the host can start the game, and every
occupied seat (human or bot) picks a base on a real map, using the engine that already exists rather
than a placeholder.

## What Changes

- Author the project's first real map: 18 regions (`Data/map.json` under `Triviador.Web`, read by a new
  `Triviador.Infrastructure` `MapRepository`), each worth 200 or 400, laid out as a simple connected
  grid — visual polish is explicitly not this change's job, a real `MapDescriptor` that satisfies
  `MapValidator` is.
- `RoomActor` gains a `GameEngine` once the host starts the game: every occupied seat (bot or human)
  becomes a `PlayerId` in seat order via `JoinGame`, then `StartGame` transitions the room into base
  selection.
- Bot seats and disconnected/unresponsive human seats need **no bot-decision code in this change**: the
  engine's own timeout-driven auto-pick (already built in `domain-kernel`) resolves any seat that
  doesn't act before its deadline. `RoomActor` only needs to arm a timer per pending activity and post
  `TimeoutElapsed` when it fires — the same mechanism covers both cases for free.
- Add the viewer-aware projection `domain-kernel` deferred: a per-player `GameViewDto` built from
  `GameState`, computed in `Triviador.Application`.
- Extend `GameHub` with `StartGame()` and `SelectBase(regionId)`; extend the client with a
  `BaseSelectionScreen` (the map, whose turn it is, a countdown, click-to-pick) and a "Start Game"
  button in the lobby (host-only, enabled once ≥2 seats are occupied).
- **Explicitly stops where the engine stops**: once every base is picked, `Phase` stays
  `BaseSelection` with `Pending == null` (a documented `domain-kernel` stub — there is no `LandGrab`
  phase yet). The client shows a clear "bases are set, next phase isn't built yet" state rather than
  pretending to continue.

## Capabilities

### New Capabilities
- `base-selection-flow`: starting a game from a filled lobby, turn-ordered base picking on a real map
  (including auto-pick on timeout for bots and unresponsive players), and the per-player view of that
  process (whose turn, deadline, map ownership) with nothing hidden that shouldn't be.

### Modified Capabilities
- `room-lobby`: adds the requirement that a room transitions out of the lobby only via an explicit host
  action once enough seats are filled, and that a seat's occupant (bot or human) becomes fixed the
  moment the game starts (host-only bot/open toggling, from the existing `room-lobby` spec, no longer
  applies once a game has started).

## Impact

- Affected code: `Triviador.Application` (new `GameSession`/engine ownership inside `RoomActor`,
  `GameViewDto` projection, new mailbox messages), `Triviador.Infrastructure` (new `MapRepository`),
  `Triviador.Web` (`Data/map.json`, `GameHub` additions), `Triviador.Client` (new
  `BaseSelectionScreen`, lobby's "Start Game" button, store additions).
- No changes to `Triviador.Domain` — this change only calls the engine that already exists.
- No automated tests added by this change specifically (see `tests/README.md`); the concurrent
  `e2e-room-lobby-tests` change covers the lobby capability this change extends, and is left alone.
