## 1. Investigate the systemic-breakpoint hypothesis

- [x] 1.1 Grepped all `max-width`/`min-width` media queries in the client CSS against the three
      target widths (393/402/421px) and landscape heights (430/450px).
- [x] 1.2 Found and live-measured `ArcheryTargetReveal.css`'s `@media (max-width: 420px)` (same
      420px threshold class as the prior reveal-column fix). Confirmed via `getBoundingClientRect()`
      on OnePlus 13R (falls outside the rule) vs iPhone 16 (inside it): no overflow, no clipping in
      either case - not applying the narrow rule just renders a proportionally larger target with no
      harm. Left unchanged; not a bug.

## 2. Diagnose the real issue found via screenshot review

- [x] 2.1 Screenshotted a Tip-question Reveal on iPhone 16 and iPhone 17: ranked-list row III/IV cut
      off mid-row, no ellipsis, `document.scrollingElement.scrollHeight === clientHeight` (so not a
      document-level scroll gap).
- [x] 2.2 Confirmed via direct `scrollTop` manipulation that `.shell-dock`'s existing `overflow-y:
      auto` fallback genuinely works (content reachable, `scrollHeight` 504-560px vs `clientHeight`
      461px) - the mechanism isn't broken, it's undiscoverable.

## 3. Add a scroll-position-tracked fade cue

- [x] 3.1 `src/Triviador.Client/src/components/AppShell.tsx`: added `useDockScrollShadows` hook
      (scroll listener + `ResizeObserver` on both `.shell-dock` and its content wrapper + a bounded
      settle-poll) and two overlay `<div>`s as `.shell-dock`'s last children.
- [x] 3.2 First attempt used the CSS `background-attachment: local`/`scroll` scroll-shadow trick on
      `.shell-dock` itself - verified via pixel-cropped screenshots that it was invisible (occluded
      by the opaque `.paper-card` content). Reverted in favor of the overlay-element approach.
- [x] 3.3 `src/Triviador.Client/src/App.css`: `.shell-dock` gains `position: relative`;
      `.dock-scroll-shadow{-top,-bottom}` styles, faded from `--paper-050` (matching the card's own
      surface color) to transparent, `z-index: 1` so they paint above the card.
- [x] 3.4 Found via live polling instrumentation that a naive `ResizeObserver`-only approach left a
      stale "visible" shadow after a transient first-paint overflow (content settling ~2-3px shorter
      a frame later, e.g. web-font metrics) resolved without triggering a callback on either observed
      element. Added the bounded settle-poll (8 ticks × 120ms) as a correctness backstop; confirmed
      via re-instrumented polling that the false positive is gone (self-corrects within ~150ms).

## 4. Verification

- [x] 4.1 `cd src/Triviador.Client && npx tsc -b --noEmit` passes.
- [x] 4.2 `dotnet build` passes (alternate `-o` path; default `bin/` locked by the running dev
      server).
- [x] 4.3 `npm test` in `tests/e2e`: 16/16 passing.
- [x] 4.4 Live verification on iPhone 16, iPhone 17, and OnePlus 13R for a Tip-question Reveal: all
      three report `scrollable: true`; before scrolling, `bottomVisibleBeforeScroll: true` and
      `topVisibleBeforeScroll: false`; after scrolling to the end,
      `bottomVisibleAfterScroll: false` and `topVisibleAfterScroll: true` - the fade correctly
      tracks real scroll position on every target device.
- [x] 4.5 Live verification on `base-selection-dock` (short, non-scrollable content): confirmed no
      false-positive shadow after the settle-poll fix (was showing a stale `bottomVisible: true`
      before the fix, despite `scrollHeight === clientHeight`).
