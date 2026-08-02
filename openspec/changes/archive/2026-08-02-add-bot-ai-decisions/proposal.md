## Why

Bots currently only occupy empty lobby seats. Once a game starts, a bot's `PlayerId` is
indistinguishable from a human's inside `GameEngine`, but nothing ever submits a command on a
bot's behalf: bots never pick a base, never pick land-grab regions, never answer trivia questions,
and never select attack targets. Every pending activity involving a bot silently stalls until its
deadline elapses and `TimeoutElapsed` fires, which is the only reason those games progress at all
right now. This makes "play vs bots" effectively unplayable at normal pace — a 4-bot game is
nothing but back-to-back timeouts. Bots need to actually play.

## What Changes

- Add a bot decision driver in `Triviador.Application` that watches for a `PendingActivity` whose
  acting player(s) include a bot seat, and submits a command on that bot's behalf through the same
  `RoomActor` methods a human client uses (`SelectBaseAsync`, `PickRegionAsync`,
  `SubmitAnswerAsync`, `SelectAttackTargetAsync`).
- Bot decisions read only the same anti-cheat-safe, per-viewer projection a human client would
  receive (`BuildGameView` / the `PendingXxxViewDto` family) — never the raw `Question`'s correct
  answer or any other server-internal state. A bot guesses blind, same information limits as a
  human.
- Bot choices are randomized (via the room's existing seeded `IRandomSource`): a random eligible
  base, a random eligible land-grab region, a random eligible attack target, a random option index
  (or a plausible-ish random numeric guess) for trivia questions.
- Bot submissions are delayed by a short, randomized "thinking time" rather than firing instantly
  or always waiting for the full deadline, so bot turns read as pacing similar to a human's, not
  as a robotic instant answer or a disguised timeout. The delay is scheduled through the room's
  existing timer/clock plumbing (`RoomActor`'s `System.Threading.Timer` + `IRoomClock`/`Instant`),
  not `Thread.Sleep` or ambient wall-clock time, and never exceeds the activity's real deadline.
- No changes to `Triviador.Domain`: bots remain purely an Application/Infrastructure concept: no
  `IsBot`/`PlayerType` is added to `PlayerState`, and `GameEngine` gains no bot-awareness.

## Capabilities

### New Capabilities
- `bot-gameplay`: bots automatically make every in-game decision (base pick, land-grab region
  pick, trivia answer, attack target pick) a human player would otherwise be prompted for, using
  only publicly-visible information and a human-like delay before submitting.

### Modified Capabilities
- `base-selection-flow`: the "unresponsive turn resolves on its own" requirement currently
  describes a bot's base pick as resolving purely via `TimeoutElapsed`, identically to a
  disconnected human. After this change, a bot actively submits a `SelectBase` command before the
  deadline in the normal case; the timeout path remains only as the fallback for a disconnected
  human (or the rare case a bot's own submission doesn't land in time).
- `land-grab-flow`: same split — the "unresponsive question or region pick resolves on its own"
  requirement's bot scenarios become "bot actively answers/picks before the deadline" instead of
  "bot resolves via timeout."
- `battle-flow`: same split for attack-target selection — the "unresponsive turn or reveal resolves
  on its own" requirement's bot scenario becomes "bot actively selects a target before the
  deadline" instead of resolving via timeout. (`RevealHold` is unaffected — no player, bot or
  human, ever acts on a reveal; it always resolves by timeout for everyone.)

## Impact

- **New code**: a bot-driving service in `Triviador.Application` (e.g. under
  `Hosting/` or a new `Bots/` folder) plus a small hook in `RoomActor` to invoke it after every
  state transition that (re)arms the engine timer.
- **Affected code**: `src/Triviador.Application/Hosting/RoomActor.cs` (wiring the bot driver into
  the existing `ArmEngineTimer`/`EngineTimerElapsed` pump), DI registration in
  `src/UI/Triviador.Web/Program.cs` if the bot driver is registered as a service.
- **No changes** to `Triviador.Domain`, wire DTOs/contracts, or `Triviador.Client` — bots consume
  the same projection and act through the same command surface humans already use.
