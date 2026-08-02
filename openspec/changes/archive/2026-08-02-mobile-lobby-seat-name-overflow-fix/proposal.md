## Why

The same third Explore sweep that found the Landing/Lobby scroll lockout also flagged `.seat-name`
(Lobby's per-seat display name) as having no shrink handling at all — confirmed via grep, no
`.seat-name` rule exists anywhere in `App.css`. A name with spaces wraps safely, but a long
unbroken token (a plausible gamer-tag, e.g. `xXDragonSlayerXx`) has no break opportunity and can
force the row wider than its container, pushing the host's "fill with bot"/"open seat" action
button out of the row. Verified via an isolated harness with an intentionally long unbroken name:
before the fix, the seat row measurably overflowed; the button's right edge could sit past the
visible width.

## What Changes

- Add a `.seat-name` rule (`flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap;`) — the same pattern already used for `.player-name` and `.reveal-name`.
- Add `gap: 0.5rem` to `.seat` so the name and button don't crowd once the name is allowed to shrink.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `mobile-viewport-interaction`: adds a scenario to the touch-target/fitting requirements covering
  a long unbroken lobby seat name truncating instead of pushing the seat's action button out of
  reach.

## Impact

- `src/Triviador.Client/src/App.css` — `.seat`/`.seat-name` rules changed. No component/TSX
  changes, no server/domain changes.
