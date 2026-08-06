## 1. Fix the signed-in-identity row's overflow

- [x] 1.1 In `src/Triviador.Client/src/App.css`, give `.signed-in-identity` `width: 100%` so it fills
      `.landing`'s fluid width instead of sizing to its children's max-content width.
- [x] 1.2 Add `.signed-in-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow:
      ellipsis; white-space: nowrap; }`.
- [x] 1.3 Add `.signed-in-signout { flex: 0 0 auto; }`.
- [x] 1.4 In `src/Triviador.Client/src/screens/LandingScreen.tsx`, add the `signed-in-name` class to
      the username `<span>` and `signed-in-signout` (alongside the existing `landing-how-to-play`
      class) to the "Sign out" `<button>`.

## 2. Verification

- [x] 2.1 `cd src/Triviador.Client && npx tsc -b --noEmit` passes.
- [x] 2.2 `dotnet build` passes (0 warnings, 0 errors) after stopping the running `dotnet watch` dev
      server to release its file lock on `Triviador.Web`'s build output, then restarting it.
- [x] 2.3 Standalone Playwright script (mocking `POST /api/auth/refresh` to reach the signed-in
      landing state without real Google OAuth) across iPhone 16 (393x659), iPhone 17 (402x681),
      OnePlus 13R (421x840), and short-landscape 932x430/975x450: confirmed `overflowX` was 28/23/14px
      on the three portrait devices before the fix (0 on the two landscape ones, already wide enough),
      and is 0 on all five after the fix, with the "Sign out" button's rect fully within the viewport
      in every case. Re-checked a normal short username ("Bob") renders unchanged.
- [x] 2.4 Same script also audited `AccountSetupScreen` (username input, 12-avatar grid, validation
      error, submit button) and the anonymous Google-sign-in-button row on all three devices - no
      issues found, no further changes made.
- [x] 2.5 `npm test` in `tests/e2e`: 16/16 passed.
