## Why

`useGameTransitions` already computes a `playerEliminated` transition every time a base falls and
its owner is eliminated - but nothing in the client consumes it. A player who gets knocked out
receives zero acknowledgment of their own elimination: they just start seeing generic "waiting for
X" banners for the rest of the match with no signal that they are now spectating rather than
waiting for their own next turn. Every other significant state change already gets a proclamation
(`app.baseFallsProclamation` fires for a captured base) - the viewer's own elimination, arguably the
single most consequential moment in the match for that player, currently gets nothing.

## What Changes

- When `transitions` includes a `playerEliminated` event whose `playerId` is the viewer's own
  (`view.youPlayerId`), show a proclamation banner (reusing the same mechanism as
  `app.baseFallsProclamation`) reading something like "You have been eliminated - you can keep
  watching until the game ends."
- This does not replace or duplicate the existing base-falls proclamation shown to everyone when a
  base is captured; it is an additional, viewer-specific notice fired by the same transition batch.
- No change to game logic, rules, DTOs, or server/domain code - client-only presentation addition
  wiring already-computed data to a UI effect.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `client-presentation`: adds a requirement that the viewer's own elimination gets a distinct,
  visible acknowledgment separate from the shared base-falls proclamation.

## Impact

- Affected code: `src/Triviador.Client/src/App.tsx` only, plus new locale entries. No server,
  domain, or DTO changes, no new dependencies.
