## 1. Strengthen wax-seal legibility on short-landscape phones

- [x] 1.1 In `src/Triviador.Client/src/App.css`, add a new top-level `@media (max-height: 428px)`
      block (after the existing `@media (max-width: 900px), (max-height: 500px)` block closes,
      matching this file's existing convention of flat, non-nested media queries) overriding
      `.wax-seal-visual`'s transform to `scale(4.2)`.

## 2. Verification

- [x] 2.1 `cd src/Triviador.Client && npx tsc -b --noEmit` passes.
- [x] 2.2 `dotnet build` passes (had to stop the file-locking `dotnet watch`-spawned
      `Triviador.Web.exe` process first, then restarted `dotnet watch` afterward).
- [x] 2.3 `npm test` in `tests/e2e`: 15/16 passing; the 1 failure
      (`kick-player.spec.ts` "territory release") is the documented pre-existing flake - confirmed
      by an isolated rerun (`npx playwright test specs/kick-player.spec.ts -g "territory release"`),
      which passed in 24.7s.
- [x] 2.4 Live Playwright audit reaching Battle's target-selection state on all three real target
      devices' landscape sizes (iPhone 16 734x343, iPhone 17 756x352, OnePlus 13R 840x421): measured
      wax-seal pip/disc diameter before/after via `getBoundingClientRect()` -
      1.27px/7.31px -> 2.96px/17.06px (iPhone 16), 1.21px/6.99px -> 3.26px/18.83px (iPhone 17),
      1.72px/9.9px -> 4.0px/23.1px (OnePlus 13R). Screenshot-verified no overlap onto neighboring
      value badges, connectors, or other bases' seals on any of the three.
- [x] 2.5 Confirmed the new rule does not fire outside its intended range:
      `window.matchMedia('(max-height: 428px)').matches` is `false` at 430px (the generic example
      already verified clean) and `true` at 421px (OnePlus 13R landscape, the tallest real target
      device needing the fix).
- [x] 2.6 Re-walked Lobby, Base Selection, a Land Grab question + reveal, and Battle target
      selection on all three real landscape sizes: `document.documentElement.scrollHeight ===
      clientHeight` (no scroll) held in every gameplay-phase check; Lobby remained intentionally
      scrollable with Start Game reachable, per the existing "Landing and Lobby remain scrollable"
      requirement.
- [x] 2.7 Audited `HowToPlayModal` on all three devices, portrait and landscape (6 viewports): close
      button 48x44 CSS px throughout, card always within `max-height: 85vh`, internal scroll usable
      and reaches all four phase summaries on the three shortest heights. No fix needed (see
      proposal.md).
