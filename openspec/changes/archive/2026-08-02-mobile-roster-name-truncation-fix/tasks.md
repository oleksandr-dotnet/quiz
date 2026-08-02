## 1. Tighten mobile roster card chrome

- [x] 1.1 In `src/Triviador.Client/src/App.css`'s mobile breakpoint, reduce `.shell-roster
      .player-card` padding to `0.35em 0.4em` and `gap` to `0.3rem`
- [x] 1.2 Add `.shell-roster .seat-swatch { width: 14px; height: 14px; flex-shrink: 0; }` (overrides
      the 18px inline SVG attributes via CSS, which wins over presentation attributes)
- [x] 1.3 Add `.shell-roster .player-name { font-size: 0.85rem; }`

## 2. Verification

- [x] 2.1 `cd src/Triviador.Client && npx tsc -b --noEmit` passes (CSS-only change, expected no-op)
- [x] 2.2 `dotnet build` passes
- [x] 2.3 Live Playwright check at 430x932 (iPhone 16 Pro Max portrait) and 450x975 (OnePlus 13
      portrait): reach `BaseSelection`, read each `.player-name` element's `textContent` and confirm
      it equals the full name (`AuditBot`, `Бот` x3) with no ellipsis/clipping, and that
      `scrollWidth <= clientWidth` still holds (no new horizontal overflow introduced)
- [x] 2.4 Screenshot comparison against the pre-fix captures confirms names are now legible instead
      of single-letter-plus-ellipsis
