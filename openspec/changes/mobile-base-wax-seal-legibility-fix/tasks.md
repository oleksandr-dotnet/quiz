## 1. Make the wax seal legible at mobile map scale

- [x] 1.1 In `src/Triviador.Client/src/components/map/WaxSeal.tsx`, wrap the seal's visual content
      (danger ring, disc, monogram text, crown, hit-point pips) in a new `<g className="wax-seal-visual">`
      inside the existing `motion.g`, leaving both existing attribute-transform-bearing groups
      (outer world-position `<g>`, `motion.g`) untouched.
- [x] 1.2 In `src/Triviador.Client/src/App.css` mobile breakpoint, add a rule scaling
      `.wax-seal-visual` by `transform: scale(1.8)` with `transform-box: fill-box; transform-origin:
      center`, matching the existing `.value-badge` pattern.

## 2. Verification

- [x] 2.1 `cd src/Triviador.Client && npx tsc -b --noEmit` passes.
- [x] 2.2 `dotnet build` passes (alternate `-o` path; default `bin/` locked by the running dev
      server).
- [x] 2.3 `npm test` in `tests/e2e`: 16/16 passing (baseline re-confirmed before starting, unaffected
      by this change).
- [x] 2.4 Live Playwright audit reaching Battle's target-selection state on all three target devices
      (iPhone 16, iPhone 17, OnePlus 13R): measured wax-seal bounding box before/after via
      `getBoundingClientRect()` - 13x17px -> 23.4x30.4px (iPhone 16), ~24x31px (iPhone 17),
      ~25.2x32.7px (OnePlus 13R). Screenshot-verified no overlap onto neighboring value badges,
      connectors, or other bases' seals on any of the three. No document scroll introduced
      (`scrollHeight === clientHeight` on all three, matching pre-change values).
