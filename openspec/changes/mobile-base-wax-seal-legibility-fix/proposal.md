## Why

Live Playwright audit of Battle's target-selection state (the map-picking sub-state between land
grab ending and a duel/assault question starting) across all three target devices - iPhone 16
(393px), iPhone 17 (402px), OnePlus 13R (~421px) - found the base wax-seal marker (the only on-map
indicator of a base's remaining hit points, which a player needs to read before deciding who to
attack) rendering at just **13x17 CSS px**, measured via `getBoundingClientRect()` on iPhone 16. At
that size the HP pips ringing the seal's rim are only a few px each - present in the DOM, but not
legibly readable during normal play.

Root cause: `.shell-map`'s mobile-breakpoint `max-height: clamp(9rem, 50vw, 16rem)` sizes the map to
roughly its natural 1200x640 viewBox aspect ratio at the shell's available width (~192-207px tall on
the three target devices), which is by design (see that rule's own comment) and not itself a bug -
the map's *area* is already about as large as it can be without either overflowing the viewport or
leaving the wasteful blank-gap the clamp was introduced to prevent. `WaxSeal.tsx`'s SVG-unit sizing
(a 15-unit disc, 2.6-unit pips), however, was never adjusted for how small that translates to at
mobile map scale - unlike `ValueBadge` (the "200"-cost shields), which already got exactly this
treatment in this same mobile-breakpoint CSS block (`.value-badge path`/`.value-badge text`, scaled
1.15-1.35x). The wax seal was the one map marker still at its unscaled, desktop-tuned size.

## What Changes

- `WaxSeal.tsx`: wrap the seal's visual content (disc, monogram text, crown, HP pips - everything
  except the two existing attribute-transform-bearing wrapper groups: the outer world-position `<g>`
  and Framer Motion's animated `motion.g`) in one more `<g className="wax-seal-visual">`, giving
  mobile CSS a transform target that won't fight either wrapper's own attribute-based `transform`
  (same hazard already documented in this file for the outer-group split, and in `.value-badge`'s
  CSS comment).
- `App.css`: add a mobile-breakpoint rule scaling `.wax-seal-visual` by 1.8x (`transform-box:
  fill-box; transform-origin: center`), matching the existing `.value-badge` pattern.
- Measured effect: seal bounding box goes from 13x17px to ~23-25px wide (23.4px iPhone 16, 24.0px
  iPhone 17, 25.2px OnePlus 13R) with pips now individually distinguishable, confirmed by screenshot
  on all three devices with no overlap onto neighboring regions, connectors, or value badges. Map's
  own footprint (`.shell-map`/svg `getBoundingClientRect()`) is unchanged - this is a marker-scale
  fix, not a layout change, so it carries none of the risk of touching the height-budget grid.

## Capabilities

### Modified Capabilities
- `mobile-viewport-interaction`: adds a requirement that a base's hit-point indicator stay legible
  at the map's mobile-breakpoint scale, alongside the existing minimum-touch-target requirement for
  dock controls.

## Impact

- `src/Triviador.Client/src/components/map/WaxSeal.tsx`
- `src/Triviador.Client/src/App.css` (mobile breakpoint only)

## Known issue found but out of scope for this change

The same Playwright audit also measured that roughly a third of the viewport (below the
target-selection turn-banner card) sits completely empty on all three target devices - `.shell-map`'s
`clamp(9rem, 50vw, 16rem)` caps the map to its natural aspect ratio at the shell's width, and per
that rule's own comment this leftover space was a deliberate tradeoff ("collects harmlessly below
the dock") to avoid an earlier bug where an uncapped map row let a light dock produce a large blank
letterboxed gap *around* an oddly-sized map. Reworking that budget to reclaim the empty space would
mean either growing the map's rendered width past the shell's padding (a bigger change, touches the
row-sizing grid the CSS comments describe as carefully tuned across every phase) or accepting a
non-native-aspect-ratio letterboxed map, and wasn't attempted here to keep this change to the one
well-scoped, low-risk fix (the seal's own legibility) that a live audit could concretely verify. A
future iteration could revisit whether that leftover space is worth reclaiming, e.g. by only
relaxing the cap specifically for the light dock states (base picking, target selection) where the
tradeoff that motivated the cap doesn't apply as strongly.
