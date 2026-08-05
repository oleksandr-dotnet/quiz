## Context

`.shell-dock`'s content is a `.paper-card`-classed element (`paper.css`: opaque `background:
var(--paper-050)`, border, shadow) that fills essentially the whole scroll area. A background
applied to `.shell-dock` itself (tried first: the classic `background-attachment: local`/`scroll`
scroll-shadow trick) is painted *behind* that child in normal stacking order and is never visible -
confirmed by cropping and inspecting the rendered pixels at the dock's edges, no fade appeared
before or after scrolling.

## Goals / Non-Goals

- Goal: a visible fade at exactly the edge(s) that still have unrevealed content, tracking real
  scroll position (not a static hint that would lie once already scrolled).
- Goal: zero visual change when a dock state doesn't need to scroll (the common case).
- Non-goal: changing `.shell-dock`'s scroll mechanism, cap, or the underlying content that
  overflows it.

## Decision

Render two small `position: absolute` overlay `<div>`s as the *last* children of `.shell-dock`
(siblings of, not inside, the `AnimatePresence` content wrapper) so they paint above the opaque card
regardless of it. A `useDockScrollShadows` hook in `AppShell.tsx` (the single shared shell every
game screen renders into) computes `top`/`bottom` visibility from `scrollTop` vs `scrollHeight` /
`clientHeight`, toggling a `visible` class consumed by CSS transitions - no inline styles, matching
this file's existing conventions.

Correctness for *when* to recompute needed three layers, found empirically:
1. A `scroll` listener on `.shell-dock` - the common, ongoing case (user actually scrolling).
2. A `ResizeObserver` on both `.shell-dock` and the content wrapper - catches a dock phase whose
   content is taller/shorter than the previous phase's.
3. A short (~1s) settle-poll re-running the check every 120ms after every `dockKey` change. Found
   necessary via direct instrumentation: on first paint, `.shell-dock`'s own `clientHeight` can
   already equal its final, settled value while `scrollHeight` (driven by the content wrapper's
   natural height) is transiently a couple pixels taller for one more frame - neither `ResizeObserver`
   target necessarily fires a callback for that, since neither element's *own* measured box has
   visibly changed yet at the moment the observer's callback runs. A stale "visible" shadow pointing
   at content that isn't actually there is worse than a brief missing one, so the settle-poll is the
   correctness backstop; `ResizeObserver` remains for genuine longer-lived content-size changes it
   does reliably catch (e.g. switching between dock phases of different natural height).

Alternatives considered:
- **`background-attachment` scroll-shadow trick on `.shell-dock`.** Rejected: verified invisible in
  practice (see Context) - the opaque child card fully occludes it.
- **Make `.paper-card`'s own background transparent inside `.shell-dock` so the ancestor's
  background-trick would show through.** Rejected: `.paper-card` is shared by every screen's dock
  content (question cards, base-selection, reveal); stripping its background/border/shadow only in
  this one nesting context is a much larger, riskier change to a shared visual primitive for what a
  couple of small overlay elements solve directly.
- **A static, unconditional "scroll for more" hint whenever a dock state is scrollable at all
  (skipping the scroll-position tracking).** Rejected: would keep showing after the player has
  already scrolled to the bottom, which is actively misleading rather than merely unnecessary.

## Risks / Trade-offs

- The settle-poll runs unconditionally on every dock-content swap (8 ticks × 120ms, ~1s), a small
  fixed overhead per phase transition. Bounded and self-clearing; verified via live instrumentation
  that it settles to the correct value and stops.
- Two additional always-present (opacity 0 by default) DOM nodes per dock render. Negligible; no
  layout impact (`position: absolute`, `pointer-events: none`).
