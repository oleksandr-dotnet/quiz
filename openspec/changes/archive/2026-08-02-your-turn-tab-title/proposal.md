## Why

Every phase of a game (base selection, land grab, battle) has moments where only one or a subset of
players need to act while everyone else waits. A player who alt-tabs away or checks another tab
while waiting has no way to notice their turn has come up except switching back and looking - the
browser tab title never changes from the static "Triviador". Turn-based web games commonly flip the
tab title (and/or favicon) to flag "it's your turn" for exactly this reason; this client has no such
cue at all.

## What Changes

- While a game is in progress and the viewer currently needs to act (they are the current base/land-
  grab picker, the current attacker choosing a target, or a participant in a pending question who
  has not yet answered), the document title SHALL read a localized "Your turn!" variant instead of
  the plain app title.
- The title SHALL revert to the plain app title the moment it is no longer the viewer's turn to act,
  and on the landing/lobby/results screens.
- No change to game logic, rules, DTOs, or server/domain code - client-only presentation addition.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `client-presentation`: adds a requirement that the document title itself signals when the viewer
  needs to act, for players who have navigated away from the tab.

## Impact

- Affected code: `src/Triviador.Client/src` only - a small "is it your turn" derivation and a
  `document.title` effect in `App.tsx`, plus new locale entries. No server, domain, or DTO changes,
  no new dependencies.
