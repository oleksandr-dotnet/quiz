## 1. Scope the scroll lockout to in-game screens only

- [x] 1.1 Change `App.css`'s mobile-breakpoint rubber-band backstop selector from
      `html, body, #root` to `html:has(.app-shell), body:has(.app-shell), #root:has(.app-shell)`

## 2. Verification

- [x] 2.1 Live check at 932×430 (iPhone 16 Pro Max/Plus landscape), 975×450 (OnePlus 13 landscape),
      and 852×393 (iPhone 16 landscape, the pre-existing-bug case): on the Landing screen, confirm
      `document.documentElement.scrollHeight > clientHeight` (content is now measurably
      scrollable, was previously clamped equal) and that `window.scrollTo(0, 9999)` actually moves
      `scrollY` (was previously a no-op). Repeat for the Lobby screen ("Start game" button).
      (Verified: all three viewports now report `canScrollDocument: true` and a real
      `scrollY` change from the scroll attempt, versus `false`/no movement before the fix.)
- [x] 2.2 Regression-check the in-game no-scroll invariant is untouched: at the same three
      viewports, reach `BaseSelection` and confirm zero document-level overflow and
      `.shell-dock`'s `scrollHeight === clientHeight` in the normal (non-stacked-reveal) case,
      matching pre-fix measurements exactly.
- [x] 2.3 `cd src/Triviador.Client && npx tsc -b --noEmit` passes (CSS-only change, expected no-op)
- [x] 2.4 `cd src/Triviador.Client && npm run build` passes
