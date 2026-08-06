## Why

Continuing the mobile UX loop's device audit (OnePlus 13R/iPhone 16/iPhone 17), with base-assault
ruled out as unreachable within one script run (it gates on `GameRules.BaseAssaultUnlockRound`,
round 8 of 12 by default) and the previously-flagged empty space below Battle's target-selection
card confirmed too risky to touch (relaxing `.shell-map`'s height cap there would reopen the exact
map-letterboxing bug that cap was added to fix, per `mobile-base-wax-seal-legibility-fix`'s own
proposal), this iteration audited Land Grab's Choice-question flow at all three target widths.

Live measurement found no scroll, overflow, or undersized tap target anywhere (all option buttons
measured 58-59px tall on every device) - but a screenshot comparison across devices turned up a
real layout problem: whenever the map is hidden while a question or reveal is showing
(`.shell-map.hide-mobile`, collapsing that grid row to 0), the existing `align-content: start` rule
dumps 100% of the resulting leftover height below the dock. On iPhone 16/17 (659-681px viewport)
there's essentially no leftover to begin with, so it's invisible. On OnePlus 13R's taller 840px
viewport, it's roughly 35-40% of the screen sitting as dead blank space under the "X/4 answered"
roster stamps - confirmed via a same-question side-by-side screenshot on all three devices - making
the layout read as top-heavy/unfinished on that device specifically, exactly the kind of thing a
"nothing ever scrolls" game should get right.

## What Changes

- `App.css`: `.app-shell:has(.shell-map.hide-mobile)` (already the rule that zeroes the map's grid
  row while a question/reveal is showing) additionally sets `align-content: center`. This does not
  reintroduce the bug the base rule's `align-content: start` exists to prevent (rows *stretching* to
  fill leftover space, inflating cards past their content height, per that rule's own comment) -
  `center` doesn't stretch anything either, it only repositions the same fixed-height rows as a
  block, splitting leftover space above and below instead of dumping all of it at the bottom.
- No JSX changes, no changes to any other grid state (base selection, target selection, battle -
  none of which hide the map) - CSS-only, scoped to exactly the state that was measured to have this
  problem.

## Capabilities

### Modified Capabilities
- `mobile-viewport-interaction`: adds a requirement that leftover vertical space, when the map's row
  is collapsed on a phone viewport, is distributed above and below the remaining content rather than
  left entirely below the dock.

## Impact

- `src/Triviador.Client/src/App.css` (one rule gains `align-content: center`, plus an explanatory
  comment)
