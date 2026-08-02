## 1. Fix the stuck-busy bug

- [x] 1.1 In `LandingScreen.tsx`, wrap the command call in each of `onCreate`, `onPlayVsBots`, and
      `onJoin` in a `try`/`catch`: on catch, call `setError(t('landing.errorGeneric'))` and
      `setBusy(false)`.

## 2. Verification

- [x] 2.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [x] 2.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [x] 2.3 Against the running dev server, use Playwright to monkey-patch the room-creation call to
      reject and confirm clicking "Play vs bots" shows the error and leaves the button clickable
      again (not stuck disabled); confirm the normal success path still works unaffected.
      (Verified: patched `WebSocket.prototype.send` to throw, clicked "Играть против 3 ботов",
      confirmed the "Что-то пошло не так" error toast appeared and the button's `disabled` property
      was `false` immediately after - not stuck. Restored `send`, reloaded for a clean connection,
      and confirmed the normal success path still creates a room correctly. Zero console errors on
      the success path.)
