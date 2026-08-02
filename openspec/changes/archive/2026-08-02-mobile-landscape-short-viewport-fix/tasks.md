## 1. Breakpoint fix

- [x] 1.1 In `src/Triviador.Client/src/App.css`, change the mobile block's selector from
      `@media (max-width: 900px)` to `@media (max-width: 900px), (max-height: 500px)` — a single
      selector change covering the fitted no-scroll shell, roster compaction, touch-target floor,
      and results compaction already inside that block.
- [x] 1.2 Confirm no other rule in the file relies on `max-width: 900px` matching by width alone in
      a way this breaks (grep for the literal breakpoint value). (Confirmed: only one occurrence in
      the file, the selector itself.)

## 2. Verification

- [x] 2.1 `cd src/Triviador.Client && npx tsc -b --noEmit` passes (CSS-only change, expected no-op).
- [x] 2.2 `dotnet build` passes.
- [x] 2.3 Live Playwright re-test at 932×430 (iPhone 16 Plus/Pro Max landscape) and 975×450
      (OnePlus 13 landscape): create a "Play vs bots" room, reach `BaseSelection`, confirm
      `document.documentElement.scrollHeight <= window.innerHeight` and the width equivalent (no
      overflow), and that all 4 roster chips are visible in one row. (Verified: both viewports now
      report `scrollHeight === clientHeight` and `scrollWidth === clientWidth` exactly, with 4
      `.player-card` roster chips present; screenshots confirm the fitted single-column layout.)
- [x] 2.4 Confirm the previously-passing viewports (852×393 iPhone 16 landscape, all portrait
      sizes, desktop ≥ 900px wide and ≥ 500px tall) are unaffected — re-run the same overflow check
      at 852×393 and at a desktop size (e.g. 1280×800). (Verified: both report zero overflow,
      unchanged from before this fix.)
