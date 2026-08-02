## 1. Fix the toast lifecycle

- [x] 1.1 In `App.tsx`, add a `useEffect` keyed on `actionError` that starts a timeout (matching the
      existing 4s proclamation window) clearing it back to `null`, cleaning up the timeout on
      change/unmount.
- [x] 1.2 Wrap the `proclamation` and `actionError` toasts in `AnimatePresence` with stable `key`s
      (e.g. `key="proclamation"` / `key="action-error"`), matching the pattern already used in
      `LandingScreen`/`LobbyScreen`/`ResultsScreen`.

## 2. Verification

- [x] 2.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [x] 2.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [x] 2.3 Against the running dev server, use Playwright to trigger a rejected action (e.g. an
      invalid `SelectBase`/attack-target command) and confirm the error toast appears then
      disappears on its own after the timeout without needing the actor to change; confirm zero
      console errors.
      (Verified: in a live land-grab question, rapid-fired two different option clicks in the same
      script tick, forcing the second `SubmitAnswer` to be genuinely rejected by the server with
      `AlreadyAnswered`. Polled within the same `browser_evaluate` call (avoiding this session's
      known round-trip-timing pitfall) and confirmed the `.toast-error` element appeared with the
      exact rejection text. Confirmed it clears without getting stuck. Zero console errors - the
      HubException is caught and handled gracefully via the existing `onError` path, not left as
      an unhandled rejection.)
