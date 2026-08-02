## Why

The mobile no-scroll fitted layout (`@media (max-width: 900px)` in `App.css`) is gated on viewport
*width* alone. In landscape, a phone's CSS width is its portrait *height* — and for smaller phones
(e.g. iPhone 16, 393×852 portrait → 852×393 landscape) that's still under 900px, so the fitted
layout still applies. But for the larger phones in this project's explicit target list it isn't:
iPhone 16 Plus/Pro Max is 430×932 portrait → 932×430 landscape, and OnePlus 13 is roughly
450×975 portrait → 975×450 landscape — both comfortably over the 900px width breakpoint. On those
two exact devices, landscape orientation falls back to the desktop two-column grid, which has no
height cap (`min-height: 100vh`/`100svh`, not `height: 100dvh`), so on a viewport only ~430-450px
tall the game screen overflows and scrolls, clipping the player roster — a direct violation of the
`mobile-viewport-interaction` spec's "game screen fits the viewport without scrolling" requirement,
confirmed by live Playwright reproduction at both exact viewport sizes (`BaseSelection` document
height measured at 529px and 552px respectively against a 430px/450px-tall viewport).

## What Changes

- Broaden the mobile fitted-layout breakpoint in `App.css` from `@media (max-width: 900px)` to
  also match short-height viewports regardless of width — `@media (max-width: 900px), (max-height:
  500px)` — so any phone held in landscape gets the no-scroll fitted shell, not only phones narrow
  enough in landscape to still be under 900px wide.
- No change to the breakpoint's existing behavior for any viewport already covered (portrait phones,
  desktop/tablet windows taller than 500px).

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `mobile-viewport-interaction`: strengthens the "game screen fits the viewport without scrolling"
  requirement so it explicitly covers short-height landscape viewports whose width exceeds the
  narrow-viewport threshold, not only viewports narrow by width.

## Impact

- `src/Triviador.Client/src/App.css` — one media-query selector change, applied to the whole
  existing mobile block (fitted shell, roster compaction, touch-target floor, results compaction).
  No component/TSX changes, no server/domain changes.
