## Why

Investigating whether `ArcheryTargetReveal.css`'s `@media (max-width: 420px)` rule had the same
off-by-a-pixel bug `mobile-reveal-answer-column-breakpoint-fix` found in `App.css` (OnePlus 13R's
421px viewport missing a 420px threshold), live measurement on all three target devices showed it
does not - not applying the narrow rule there just renders a bigger archery target with no overflow.

But screenshotting the same Tip-question Reveal on iPhone 16 turned up something real: the ranked
answer list was cut off mid-row ("III" with nothing below it, no ellipsis, no visible scrollbar).
`.shell-dock`'s `max-height: 70dvh; overflow-y: auto` (the sanctioned scroll fallback per
`mobile-viewport-interaction`) was working exactly as designed - confirmed via
`getBoundingClientRect()`/`scrollTop` manipulation, the content is fully reachable by scrolling the
dock. The bug is discoverability: this is otherwise a "nothing ever scrolls" game (the map, roster,
and top bar are all fixed-fit by design), so nothing trains a player to try swiping one specific
panel, and the scrollbar itself is invisible-by-default on mobile Safari/Chrome until actively
dragged. A player who doesn't already know to try scrolling that card loses the bottom of the ranked
list with zero visual cue that more exists.

## What Changes

- `AppShell.tsx`: track `.shell-dock`'s real scroll position (scroll listener + `ResizeObserver` +
  a brief settle-poll after every dock-content swap, needed because the dock's own box can already be
  measured stable while its content's natural height is still a couple px taller for one more frame -
  confirmed live, e.g. web-font metrics swapping in just after first paint) and render two small edge
  overlay elements reflecting it.
- `App.css`: style those overlays as a fade from the dock content's actual card color
  (`--paper-050`) to transparent, positioned after (so painted above) the dock's own opaque
  `.paper-card` content, visible only on the edge that genuinely still has more to reveal.
- No change to the scroll mechanism itself - `.shell-dock`'s `overflow-y: auto` and `70dvh` cap are
  untouched. This only makes the existing, already-correct fallback discoverable.

## Capabilities

### Modified Capabilities
- `mobile-viewport-interaction`: adds a requirement that the dock's existing scroll fallback show a
  visible edge cue when there's more content to reveal in that direction, since a "nothing ever
  scrolls" game gives no other reason for a player to try.

## Impact

- `src/Triviador.Client/src/components/AppShell.tsx` (scroll-position tracking hook, two overlay
  elements)
- `src/Triviador.Client/src/App.css` (`.dock-scroll-shadow` styles, `.shell-dock` gains `position:
  relative`)
