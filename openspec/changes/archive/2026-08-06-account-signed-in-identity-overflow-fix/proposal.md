## Why

This iteration audited the account setup / auth flow (`AccountSetupScreen`, `GoogleSignInButton`,
and the signed-in state on `LandingScreen`) across the project's three target mobile devices, an
area not yet specifically re-verified since the pre-loop `AccountSetupScreen` placeholder-clipping
fix. A scripted layout pass (mocking `POST /api/auth/refresh` to reach a signed-in profile, since
real Google OAuth isn't feasible headless) with a stress-length unbroken username found a real bug:
`LandingScreen`'s `.signed-in-identity` row (avatar + "Signed in as {username}" + "Sign out") has no
width constraint or text-truncation handling, so a long unbroken username pushes the whole row wider
than the viewport. Measured with `getBoundingClientRect()`/`document.scrollingElement`, this produced
document-level horizontal overflow of 28px (iPhone 16), 23px (iPhone 17), and 14px (OnePlus 13R),
with the row's left edge shifted to a negative `x` and the "Sign out" button's right edge pushed past
the viewport's right edge - a real, reachable-only-by-accidental-scroll control, on all three target
devices. This is the exact same failure pattern the `mobile-viewport-interaction` spec's lobby
`.seat-name` scenario already exists to prevent, just on a different row that didn't get the same
treatment.

## What Changes

- Fix: `.signed-in-identity` (`src/Triviador.Client/src/App.css`) now takes `width: 100%` instead of
  sizing to its content (the `.landing` column flex container's `align-items: center` otherwise sizes
  it to max-content, which is what let it overflow). The username text (`.signed-in-name`, new class
  on the existing `<span>` in `LandingScreen.tsx`) gets `flex: 1 1 auto; min-width: 0; overflow:
  hidden; text-overflow: ellipsis; white-space: nowrap`; the "Sign out" button (`.signed-in-signout`,
  new class on the existing `<button>`) gets `flex: 0 0 auto` so it never shrinks and stays fully
  visible. No structural or logic change - two new class names added to elements that already existed.
- Verified across iPhone 16 (393x659), iPhone 17 (402x681), OnePlus 13R (421x840), and short-landscape
  932x430/975x450: document-level `overflowX` is 0 on all five configurations after the fix (vs. 28/
  23/14px before, on the three portrait devices - the landscape ones were never affected, being wide
  enough already), and the "Sign out" button's rect stays fully within the viewport. A normal
  short username ("Bob") renders unchanged, confirming no visual regression for the common case.
- Same pass also audited (no other bug found, no code change) `AccountSetupScreen`'s username input,
  12-avatar grid (touch targets ~47px tall, comfortably above the 44x44 minimum), validation-error
  text, and submit button on all three devices - all correct, with `AccountSetupScreen`'s own
  content-taller-than-viewport case scrolling normally exactly as the existing "Landing and Lobby
  remain scrollable" requirement already sanctions. The anonymous (not-signed-in) Google-sign-in
  button row was also checked and renders correctly (43px tall, within the card) on all three devices.

## Capabilities

### Modified Capabilities
- `mobile-viewport-interaction`: extends the existing "keep each roster card's player-name field wide
  enough..." touch-target requirement's family of long-unbroken-name scenarios (previously only
  covering the lobby seat row) to also cover the landing screen's signed-in-identity row: a long
  unbroken username now truncates with an ellipsis instead of pushing the "Sign out" button and the
  row itself off-screen.

## Impact

- `src/Triviador.Client/src/App.css` - `.signed-in-identity`/`.signed-in-name`/`.signed-in-signout`
  rules.
- `src/Triviador.Client/src/screens/LandingScreen.tsx` - two new `className`s on already-existing
  elements, no JSX structure change.
- No server/domain/application changes.
