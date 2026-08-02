## Why

`RegionShape` already sets a complete `aria-label` on each region's `<g>` (name, value, and owner).
But `GameMap` separately renders each region's name `<text>` and value badge, and each base's
wax-seal marker, in their own `<g>` groups marked only `pointerEvents="none"` - not `aria-hidden`.
SVG `<text>` is exposed to the accessibility tree by default, so a screen reader traversing the map
hits every region's name/value twice (once as the region button's label, once again as bare text)
and every base's owner name a second time too - confusing noise, not a cosmetic nitpick, for anyone
using a screen reader to navigate the board.

## What Changes

- Add `aria-hidden="true"` to the region name/value-badge `<g>` group and the base wax-seal marker
  `<g>` group in `GameMap.tsx`, since both are purely decorative duplicates of information already
  carried by `RegionShape`'s `aria-label`.
- No visual change whatsoever - `pointerEvents="none"` already made both groups non-interactive;
  this only removes them from the accessibility tree.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `map-rendering`: adds a requirement that decorative label/marker layers drawn over the map don't
  duplicate the region shape's own accessible name.

## Impact

- Affected code: `src/Triviador.Client/src/components/map/GameMap.tsx` only. No server, domain, or
  DTO changes, no new dependencies.
