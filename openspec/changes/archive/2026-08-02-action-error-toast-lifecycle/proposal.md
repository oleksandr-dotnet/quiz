## Why

`App.tsx`'s in-game `actionError` toast (shown when a rejected pick/attack-target/answer command
fails) is only cleared when the "current actor" changes (a new question, picker, or attacker) - it
has no auto-dismiss timeout. If a rejection happens and the actor doesn't change soon after (the
same picker retries, or the deadline is still far off), the red error toast stays glued to the dock
indefinitely. Unlike every other toast in the client (landing, lobby, results, the `proclamation`
toast in this same dock), it also isn't wrapped in `AnimatePresence`, so it has no exit transition
and can pop in/out abruptly stacked above `proclamation` with no visual separation between the two.

## What Changes

- Add an auto-dismiss timeout to `actionError`, matching the pattern already used for
  `proclamation` in the same file.
- Wrap both the `proclamation` and `actionError` toasts in `AnimatePresence` with stable keys, so
  each gets the same mount/exit transition every other toast in the client already has.
- No change to game logic, rules, DTOs, or server/domain code - client-only consistency fix.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `client-presentation`: adds a requirement that an action-rejection toast, like every other toast
  in the client, dismisses on its own rather than only on an unrelated state change.

## Impact

- Affected code: `src/Triviador.Client/src/App.tsx` only. No server, domain, or DTO changes, no new
  dependencies.
