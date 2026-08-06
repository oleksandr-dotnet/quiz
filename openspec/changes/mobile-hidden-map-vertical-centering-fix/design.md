## Context

`.app-shell` is a CSS grid (`top | map | roster | dock` rows). At the phone breakpoint, the base
rule sets `align-content: start` specifically to stop leftover vertical space *stretching* each
auto-sized row (which used to visibly inflate the roster cards past their content height - see that
rule's own comment in `App.css`). When the map is hidden (`.shell-map.hide-mobile`, applied while a
question or reveal is showing), a more specific rule zeroes the map's own row
(`grid-template-rows: auto 0 auto auto`) but didn't touch `align-content`, so it inherited `start`
from the base rule - meaning 100% of whatever leftover space exists collects below the dock.

On iPhone 16/17 (659-681px viewport) that leftover is near zero, so it was never visible. On
OnePlus 13R (840px) it's real: confirmed via live measurement, ~35-40% of the viewport sitting empty
below the "X/4 answered" roster stamps on an ordinary Choice question.

## Goals / Non-Goals

- Goal: redistribute that specific leftover space (map-hidden state only) without reintroducing the
  row-stretching bug the base rule's `align-content: start` prevents.
- Non-goal: touching the Battle target-selection empty-space case (map visible, capped height) -
  already investigated and rejected as too risky in `mobile-base-wax-seal-legibility-fix`; relaxing
  that cap would reopen the map-letterboxing bug it was added to fix. Out of scope here.
- Non-goal: making the shell "fill" the viewport by growing content (font/card sizes) - a bigger,
  riskier change than repositioning existing rows.

## Decision

Add `align-content: center` to the existing `.app-shell:has(.shell-map.hide-mobile)` rule (already
scoped to exactly the map-hidden state). `center` doesn't stretch rows - each row keeps its own
auto/content-driven height - it only repositions the block of rows within the grid container, so:
- Where there's leftover space (OnePlus 13R), it now splits above/below instead of 100% below.
- Where there's no leftover space (iPhone 16/17), it's a no-op - rows already fill the container.
- Where the dock's own content forces its `70dvh`-capped scroll fallback (the existing
  long-question case), total row height still can't exceed the container, so centering never causes
  clipping at the top - it only ever activates when there's genuine leftover to redistribute.

### Alternatives considered
- **`space-between`/`space-around` on rows**: rejected - would insert gaps *between* top bar,
  roster, and dock too, visually disconnecting sections that are meant to read as one contiguous
  card stack.
- **Growing map/card sizes to fill the space**: rejected as a much larger, riskier change (touches
  the same carefully-tuned row-sizing budget `.shell-map`'s own comments describe) for a
  cosmetic-only gain; centering achieves the actual goal (stop reading as broken) with a one-line,
  purely repositional change.

## Risks / Trade-offs

- `align-content: center` on a grid container is a coarse tool - it affects the whole shell, not
  just "below the dock". Mitigated: scoped via `:has()` to exactly the map-hidden state (already the
  narrowest state this problem was measured in), and verified as a no-op on the two devices that
  don't have leftover space to redistribute.
