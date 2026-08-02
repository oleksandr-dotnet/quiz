## Why

`MapViewport`'s `endPointer` unconditionally nulls `pinchStartRef`/`panStartRef` on any pointer-up
or pointer-cancel, regardless of which pointer ended or how many are still down. During an active
two-finger pinch, if a third finger briefly touches the screen (a palm graze, or two-handed tablet
use - both common on touch devices) and then lifts, `pointersRef` drops back to size 2, but
`endPointer` still nulled `pinchStartRef` for that event, and the size-2 branch that would
re-baseline it only ever ran on the original `pointerdown`, not on `pointerup`/`pointercancel`. The
result: `handlePointerMove`'s `pointersRef.current.size >= 2 && pinchStartRef.current` guard now
fails even though two real pinch fingers are still down, and the map stops responding to that pinch
entirely until every finger lifts and the gesture restarts from scratch - a real, reproducible
"interrupted gesture" bug, not a hypothetical one.

## What Changes

- In `endPointer`, when at least two pointers remain after removing the one that just ended,
  re-baseline `pinchStartRef` from the two remaining pointers' current positions and the current
  scale (the same computation already done in `handlePointerDown`'s two-pointer branch), instead of
  nulling it.
- The existing size-1 (drop to pan) and size-0 (fully released) behaviors are unchanged.
- No change to game logic, rules, DTOs, or server/domain code - client-only gesture-handling fix.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `mobile-viewport-interaction`: strengthens the existing pinch-zoom requirement so a stray extra
  touch during an active pinch doesn't freeze it.

## Impact

- Affected code: `src/Triviador.Client/src/components/map/MapViewport.tsx` only. No server, domain,
  or DTO changes, no new dependencies.
