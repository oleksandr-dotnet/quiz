## 1. Geography data generation

- [ ] 1.1 Read `src/UI/Triviador.Web/Data/map.json` and record the exact 16 `RegionId` strings and
      display names to map against ISO-3166 country codes.
- [ ] 1.2 Add `d3-geo`, `topojson-client`, and `world-atlas` as `devDependencies` in
      `src/Triviador.Client/package.json`.
- [ ] 1.3 Write `src/Triviador.Client/scripts/generate-europe-paths.mjs`: load `world-atlas`'s 50m
      countries topojson, convert via `topojson-client`, filter to the 16 ISO numeric ids, project
      with `d3.geoMercator().fitSize(...)` against the existing `1200x700` viewBox, and emit per-region
      `{ path: string, centroidX: number, centroidY: number }`.
- [ ] 1.4 Run the script and commit its output as
      `src/Triviador.Client/src/components/map/europeGeography.ts`, keyed by `RegionId`.
- [ ] 1.5 Visually sanity-check the generated shapes (e.g. via a throwaway HTML preview) against a
      real Europe map before wiring them into the app — confirm relative positions/proportions read
      correctly, adjust the fitted viewBox padding if any country is clipped or badly skewed.

## 2. Region rendering

- [ ] 2.1 Update `RegionShape.tsx` to accept the geometry payload (`path`, centroid) and render a
      `<path>` in place of the base `<circle>`, keeping existing props/behavior for owner color,
      eligibility highlight, and contested marker as overlays on that path.
- [ ] 2.2 Add the circle-fallback branch in `RegionShape.tsx` for any `RegionId` missing from
      `europeGeography.ts`, using the server's `centerX/centerY/radius`.
- [ ] 2.3 Update `GameMap.tsx` to source adjacency line endpoints, labels, and wax-seal positions from
      the geometry centroid (falling back to server `labelX/labelY` when provided as an override),
      instead of `centerX/centerY`.
- [ ] 2.4 Confirm claim-wash/contested/eligibility animations (Framer Motion) still target the new
      `<path>` elements correctly.

## 3. Responsive layout

- [ ] 3.1 Replace `.app-shell`'s fixed `max-width: 72rem` in `App.css` with a `clamp()` that grows on
      wide viewports; tune bounds by eye against a 2K (2560x1440 or 1920x1080-scaled) target.
- [ ] 3.2 Change the two-column grid template from a fixed `18rem` dock column to a
      viewport-relative `minmax(16rem, 22vw)` (or similar) so the dock scales with the board.
- [ ] 3.3 Add a `min-width: 1440px` (or tuned value) breakpoint increasing gaps/padding for large
      desktops.
- [ ] 3.4 Adjust the existing `max-width: 900px` phone breakpoint as needed (e.g. `svh`-based height
      clamp) so short landscape phones don't force excessive scrolling; verify no horizontal
      scrollbar appears at common phone widths (360-430px).
- [ ] 3.5 Check `theme/paper.css` root sizing constraints don't conflict with the new shell scaling.

## 4. Verification

- [ ] 4.1 Run `npm run dev`, load the app, and visually confirm the board reads as a real map of
      Europe (not a node graph) in base selection and land grab screens.
- [ ] 4.2 Resize the browser through phone, tablet, laptop, and large-desktop widths (or use browser
      devtools device emulation plus a manual large-viewport check) and confirm the board scales
      fluidly with no clipped content, no horizontal scroll on phone widths, and visible growth at
      2K-class widths.
- [ ] 4.3 Run `npx tsc -b --noEmit` in `src/Triviador.Client` and fix any type errors introduced.
