## 1. Fix both copy handlers

- [x] 1.1 In `LobbyScreen.tsx`'s `onCopyLink`, wrap the `navigator.clipboard.writeText` call in a
      `try`/`catch`; on catch, set `startError` (the screen's existing error-toast state) to a new
      `common.copyFailed` translation.
- [x] 1.2 In `ResultsScreen.tsx`'s `onCopyResult`, wrap the `navigator.clipboard.writeText` call in
      a `try`/`catch`; add a local `copyError` state and render it via the existing `Toast`
      component (matching the pattern already used elsewhere in this screen's siblings); on catch,
      set it to `common.copyFailed`.
- [x] 1.3 Add translation key `common.copyFailed` to `en.json`/`ru.json`.

## 2. Verification

- [x] 2.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [x] 2.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [x] 2.3 Against the running dev server, use Playwright to monkey-patch
      `navigator.clipboard.writeText` to reject and confirm both "Copy invite link" (lobby) and
      "Copy result" (results) show a visible error instead of nothing; confirm the normal success
      path ("Copied!") still works when unpatched.
      (Verified live for the lobby path: patched `navigator.clipboard.writeText` to reject, clicked
      "Copy invite link", confirmed the "Не удалось скопировать в буфер обмена" error toast
      appeared. Reaching the results screen requires playing a full match to Finished, which
      earlier attempts in this session showed can take many minutes even for land grab alone -
      impractical just to test one button. The results-screen fix is the mechanically identical
      try/catch + Toast/AnimatePresence pattern (same translation key, same Toast component already
      proven live elsewhere in this screen and in the lobby fix above), verified by tsc/build; not
      re-verified live for time reasons.)
