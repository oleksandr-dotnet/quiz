## 1. Fix

- [x] 1.1 Add `.seat-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow:
      ellipsis; white-space: nowrap; }` and `gap: 0.5rem` on `.seat` to `App.css`

## 2. Verification

- [x] 2.1 Isolated CSS harness at 393px width with an unbroken ~36-character seat name: confirm
      `.seat.scrollWidth === .seat.clientWidth` (no overflow) and the action button's
      `getBoundingClientRect().right <= window.innerWidth` (fully visible)
- [x] 2.2 `cd src/Triviador.Client && npx tsc -b --noEmit` passes (CSS-only, expected no-op)
- [x] 2.3 `cd src/Triviador.Client && npm run build` passes
