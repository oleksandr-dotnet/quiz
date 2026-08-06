## Why

Every mobile-viewport landscape check so far this session used the spec's generic example
dimensions (932x430, 975x450 - a Pro-Max-sized phone) rather than this project's three actual
target devices held sideways. A live Playwright audit against their real landscape viewports -
iPhone 16 (734x343), iPhone 17 (756x352), OnePlus 13R (~840x421) - reaching Battle's
target-selection state found the base wax-seal marker (fixed for portrait/generic-landscape
legibility in `mobile-base-wax-seal-legibility-fix`) illegible again at these narrower heights:
hit-point pips measured via `getBoundingClientRect()` at just **1.21-1.72 CSS px diameter** (disc
6.99-9.9px), well under the ~2.8px pip / ~16px disc the earlier fix's 1.8x scale already produces -
and was accepted as legible - at portrait heights (~192-207px map row) or at the generic 430px+
landscape examples (measured 173.6px map row at 932x430, close to the portrait baseline, no fix
needed there).

Root cause: `.shell-map`'s row is the one flexible row in the mobile grid (`minmax(0, max-content)`)
and has no minimum height - on a landscape phone this short, the fixed-height top bar, roster, and
dock leave only ~78-117px for the map, well below the ~190px the existing 1.8x wax-seal scale was
calibrated against. The map's own layout/no-scroll behavior is unaffected (still fits with no
scroll on all three), but the seal shrinks along with the map row and drops below legibility.

## What Changes

- `App.css`: add a `@media (max-height: 428px)` rule (scoped strictly to viewports shorter than the
  narrowest generic example already found clean at 430px, so it does not touch the portrait or
  larger-landscape cases the existing 1.8x scale already handles well) raising `.wax-seal-visual`'s
  transform scale to 3.6-4.2x - large enough that all three real target devices' landscape sizes
  reach or exceed the existing portrait baseline (disc 17.06-23.1px, pip 2.96-4.0px measured after
  the fix, versus the 16.24px/2.82px portrait reference).
- No change to `.shell-map`'s own sizing/clamp, `WaxSeal.tsx`, or any other layout rule - this only
  strengthens the marker-scale multiplier already established by the prior fix, for a height range
  that fix's own baseline measurement didn't cover.

## Capabilities

### Modified Capabilities
- `mobile-viewport-interaction`: extends the existing wax-seal-legibility requirement's scenario
  coverage to explicitly include this project's three real target devices' landscape orientations,
  not just narrow-width portrait viewports.

## Impact

- `src/Triviador.Client/src/App.css` (new short-landscape media query only)

## How to play modal (audited, no fix needed)

The same session also audited `HowToPlayModal` on all three target devices, portrait and their real
landscape sizes (6 viewports total): close button consistently 48x44 CSS px (the breakpoint's
generic `button { min-height/min-width: 44px }` rule already covers it), card always fully within
the viewport with `max-height: 85vh` capping it, and internal scroll (`overflow-y: auto`) correctly
kicks in and remains fully usable on the three shortest landscape heights (513px of content in a
~290-356px-tall card) - all phase summaries reachable by scrolling, no clipped content. No change
needed; this is a clean audit, not a separate change.
