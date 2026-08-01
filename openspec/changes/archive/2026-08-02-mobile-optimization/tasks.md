## 1. Map topology trim

- [x] 1.1 Update `src/UI/Triviador.Web/Data/map.json`: change `id` to `europe-8`, remove the 8
      small regions (Portugal, Ireland, Belgium, Netherlands, Switzerland, Austria, Czechia,
      Denmark), and rewrite `adjacentTo` for the 8 survivors per design.md's table (adding the new
      Germany-Italy and Germany-Sweden edges).
- [x] 1.2 Update `src/Triviador.Client/scripts/generate-europe-paths.mjs`'s country list to drop the
      8 cut countries (and any now-unneeded `LABEL_NUDGES` entries for them).
- [x] 1.3 Re-run the generator to regenerate `src/Triviador.Client/src/components/map/europeGeography.ts`
      with only the 8 surviving regions.
- [x] 1.4 Build and manually sanity-check base selection + land grab locally: confirm all 8 regions
      render, adjacency lines match the new table, and 4 simulated bases can be placed at
      `MinimumBaseDistance` apart without the relax-fallback triggering.

## 2. MapViewport (pinch/pan/zoom)

- [x] 2.1 Create `src/Triviador.Client/src/components/map/MapViewport.tsx`: a wrapper div holding
      scale/offset in a ref, applying `transform: translate() scale()` directly to the DOM node.
- [x] 2.2 Implement pointer tracking: pointerdown/move/up/cancel handlers maintaining a
      `Map<pointerId, {x,y}>`, with `setPointerCapture` on pointerdown.
- [x] 2.3 Implement two-pointer pinch-to-zoom (distance ratio, clamped to `[1, 4]`, zoom centered on
      pinch midpoint) and single-pointer pan when `scale > 1` (clamped so the map can't pan past its
      own edge).
- [x] 2.4 Implement double-click/double-tap zoom toggle (scale 1 <-> 2.5, centered on the tap point)
      and desktop wheel-zoom (centered on cursor position).
- [x] 2.5 Implement dynamic `touch-action` (`'pan-y'` while unzoomed and single-pointer, `'none'`
      once a second pointer lands or scale > 1) set imperatively alongside the transform.
- [x] 2.6 Add a "Reset view" button, shown only when `scale !== 1`, that restores scale 1 and
      centered offset.
- [x] 2.7 Wire `MapViewport` into `App.tsx`'s `map` slot, wrapping the existing `<GameMap>` element
      unchanged.
- [x] 2.8 Add `.map-viewport` styles to `App.css` (overflow hidden, position relative, sizing to
      fill `.shell-map`).

## 3. Orientation nudge

- [x] 3.1 Create a `RotateDeviceGate` component: tracks `matchMedia('(orientation: portrait)')` live,
      and a dismissed-for-this-orientation-session boolean.
- [x] 3.2 Gate visibility on viewport width < phone breakpoint AND portrait AND
      `gameView.phase` in `{BaseSelection, LandGrab, Battle}`.
- [x] 3.3 Add the overlay markup: rotate message, "Go fullscreen & rotate" button, "Continue in
      portrait" dismiss button.
- [x] 3.4 Implement the fullscreen+lock attempt: `element.requestFullscreen()` then, on the
      fullscreen-change event, `screen.orientation.lock('landscape')` wrapped in try/catch; both
      failures are silent no-ops with no visible error.
- [x] 3.5 Reset the dismissed flag when the viewport re-enters portrait after being dismissed while
      in landscape, so returning to portrait re-prompts.
- [x] 3.6 Mount `RotateDeviceGate` in `App.tsx` alongside the main game render.

## 4. Touch-target and layout CSS pass

- [x] 4.1 Inside the existing `@media (max-width: 900px)` block in `App.css`, bump button /
      `.option-plate` / `.numeric-keypad-key` sizes so their tappable area is at least 44x44px.
- [x] 4.2 Add `safe-area-inset-*` padding to `.app-shell` inside the same breakpoint.
- [x] 4.3 Add `touch-action: manipulation` to buttons/interactive elements to remove tap delay.

## 5. Viewport meta

- [x] 5.1 Update `src/Triviador.Client/index.html`'s viewport meta to add `viewport-fit=cover`
      (keep pinch-zoom un-blocked at the browser level; MapViewport handles map-specific zoom).

## 6. Verification

- [x] 6.1 `cd src/Triviador.Client && npx tsc -b --noEmit` passes.
- [x] 6.2 `dotnet build` passes.
- [x] 6.3 Manually test in a running game (per CLAUDE.md's dev loop) on an emulated phone viewport
      (Playwright resize + touch emulation, or browser devtools device mode): verify pinch/pan on
      the map, the rotate nudge appears in portrait during an active phase and not in the
      lobby/results, reset-view works, and no regression to the desktop layout.
