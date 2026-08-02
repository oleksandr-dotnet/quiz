## Why

The client has no React error boundary anywhere in its tree. An uncaught render exception in any
component (confirmed happening historically for `MapViewport` per browser console history, during
active development) unmounts the entire React tree, leaving the player looking at a blank white
page with no explanation and no way to recover short of a manual reload - even when the underlying
SignalR connection and room state are still perfectly fine. This is a baseline reliability/UX gap:
production React apps should never let one component's render bug take down the whole screen with
zero recovery affordance.

## What Changes

- Add a class-based `ErrorBoundary` component that catches render errors in its subtree, logs the
  error (and component stack) to the console for diagnosis, and renders a themed fallback screen
  instead of unmounting to blank white.
- The fallback screen SHALL be styled consistently with the existing parchment/paper theme (reusing
  existing tokens/classes, not a plain browser-default error page), show a short apologetic message,
  and offer a reload action that reloads the page.
- Wrap the app shell (`AppShell`, inside `App.tsx`) with this boundary so a crash anywhere in the
  game UI is contained.
- No change to game logic, rules, DTOs, or server/domain code - this is a client-only presentation
  safety net.

## Capabilities

### New Capabilities
- `client-error-recovery`: The client's obligation to contain a render error to a themed fallback
  screen with a recovery action, instead of unmounting to a blank page.

### Modified Capabilities
(none - `client-presentation` already covers rendering obligations broadly, but "contain a crash"
is a distinct new requirement, not a change to an existing one)

## Impact

- Affected code: `src/Triviador.Client/src` only - a new `ErrorBoundary` component plus its wiring
  into `App.tsx` (or `main.tsx`). No server, domain, or DTO changes.
- No new dependencies - implemented with React's built-in `componentDidCatch`/
  `getDerivedStateFromError` class-component API.
