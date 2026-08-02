## 1. ErrorBoundary component

- [x] 1.1 Create `src/Triviador.Client/src/components/ErrorBoundary.tsx` with a class component
      implementing `getDerivedStateFromError` (sets `hasError`/`error` state) and
      `componentDidCatch(error, info)` (logs `error` and `info.componentStack` to `console.error`).
- [x] 1.2 In `componentDidCatch`, also render a fallback: a small function component
      `ErrorFallback` (in the same file, using `useTranslation` since the class component can't use
      hooks directly) styled with the existing `.paper-card` class, showing an apologetic message
      and a reload button that calls `window.location.reload()`.
- [x] 1.3 Add translation keys `errorBoundary.title`, `errorBoundary.message`, and
      `errorBoundary.reload` to both `src/Triviador.Client/src/i18n/resources/en.json` and
      `ru.json`.

## 2. Wire into the app

- [x] 2.1 In `src/Triviador.Client/src/main.tsx`, wrap `<App />` with `<ErrorBoundary>` (inside
      `StrictMode`, so it also catches errors during the dev double-render).
- [x] 2.2 Confirm no other files under `src/Triviador.Client/src` needed changes beyond the new
      component, the two locale files, and `main.tsx`.

## 3. Verification

- [x] 3.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [x] 3.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [x] 3.3 Against the running dev server, use Playwright to force a render error in a mounted
      component (e.g. via `browser_evaluate` monkey-patching, or a temporary throw) and confirm the
      themed fallback renders (not a blank page), the reload button is present, and the error is
      visible via `browser_console_messages`. Remove any temporary throw-forcing code added purely
      for this check before committing.
      (Verified: added a temporary `?forceError=1`-gated throw in `App.tsx`, navigated to it,
      confirmed the "Something tore the parchment" fallback card rendered with the reload button
      and the error + component stack appeared in the console. Clicked reload, confirmed a real
      page reload occurred. Removed the temporary throw and confirmed the app returns to normal -
      reconnected to an in-progress Battle-phase game via the persisted session token with no
      console errors.)
