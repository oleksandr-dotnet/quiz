## Why

Both `LobbyScreen`'s "Copy invite link" and `ResultsScreen`'s "Copy result" call
`navigator.clipboard.writeText(...)` unguarded. In an insecure context, an iframe, or a browser
where clipboard permission is denied - all realistic conditions - this promise rejects. With no
`catch`, the click silently does nothing: no "Copied!" confirmation, no error, nothing. The player
has no way to tell whether their click registered at all, and the same bug is duplicated in both
otherwise-identical features.

## What Changes

- Wrap both `navigator.clipboard.writeText` calls in a `try`/`catch`. On rejection, show a visible
  error (reusing each screen's existing error-surfacing pattern) instead of leaving the click
  looking like it did nothing.
- No change to game logic, rules, DTOs, or server/domain code - client-only reliability fix.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `client-presentation`: adds a requirement that a failed clipboard-copy action is never silent.

## Impact

- Affected code: `src/Triviador.Client/src/screens/LobbyScreen.tsx` and
  `src/Triviador.Client/src/screens/ResultsScreen.tsx` only, plus a new locale entry. No server,
  domain, or DTO changes, no new dependencies.
