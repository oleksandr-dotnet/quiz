## Why

`LandingScreen`'s `onCreate`/`onPlayVsBots`/`onJoin` set `busy = true` then `await` the room
command with no `try`/`catch`. `handleResult` only clears `busy` on the *resolved* rejection path
(`result.success === false`) - if the underlying SignalR `invoke` promise itself rejects (a dropped
connection, not-yet-connected, or timeout - all realistic conditions, especially right after a page
load), the `await` throws, `handleResult` never runs, and `busy` stays `true` forever. Every action
button on the landing screen becomes permanently disabled with no error shown, and the only way out
is a full page reload. This is a real reliability bug, not a hypothetical one.

## What Changes

- Wrap each of `onCreate`/`onPlayVsBots`/`onJoin`'s command call in a `try`/`catch`: on a rejected
  promise, show a generic error (`landing.errorGeneric`) and clear `busy`, exactly like the existing
  resolved-rejection path already does.
- No change to game logic, rules, DTOs, or server/domain code - client-only reliability fix.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `client-presentation`: adds a requirement that a failed room-connection attempt always leaves the
  landing screen's actions usable again, never stuck disabled.

## Impact

- Affected code: `src/Triviador.Client/src/screens/LandingScreen.tsx` only. No server, domain, or
  DTO changes, no new dependencies.
