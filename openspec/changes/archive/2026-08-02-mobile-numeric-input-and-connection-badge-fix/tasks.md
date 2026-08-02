## 1. Numeric input row fix

- [x] 1.1 Add `.numeric-input-row input { flex: 1 1 auto; min-width: 0; width: 100%; }` and
      `.numeric-input-row button { flex-shrink: 0; }` to `App.css`
- [x] 1.2 Verify via an isolated CSS harness (real served `App.css`/`index.css`, same markup, at
      393px viewport) that `row.scrollWidth === row.clientWidth` after the fix (was 355 vs 319
      before) and the button renders at its full natural width inside the card

## 2. Connection badge fix

- [x] 2.1 Change `.connection-badge` to `position: fixed`, centered horizontally, `top: max(0.75rem,
      env(safe-area-inset-top))`, with a `max-width` accounting for safe-area insets left/right
- [x] 2.2 Verify live: at 393×852, reach `BaseSelection`, inject the exact `connection-badge
      reconnecting` markup as the first child of `body` (matching its real DOM position), confirm
      `document.documentElement.scrollHeight`/`scrollWidth` are unchanged before and after (both
      852/393, no overflow introduced)

## 3. Verification

- [x] 3.1 `cd src/Triviador.Client && npx tsc -b --noEmit` passes (CSS-only change, expected no-op)
- [x] 3.2 `cd src/Triviador.Client && npm run build` passes (whole-solution `dotnet build` was
      blocked by the running `dotnet watch`'s file lock on the Application/Domain/Infrastructure
      DLLs - an environmental artifact of the dev server already running, unrelated to this
      CSS-only change; the client production build is the correct verification here and succeeded)
- [x] 3.3 Screenshot confirms the submit button and the connection badge both render fully within
      the viewport with no clipping
