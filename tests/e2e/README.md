# tests/e2e

Playwright end-to-end tests, driven against a real running `Triviador.Web` + `Triviador.Client`
through a real browser. This is the first content in `tests/` (see `tests/README.md`) - it covers
the `room-lobby` capability (`openspec/specs/room-lobby/spec.md`).

## Running

```powershell
cd tests/e2e
npm install
npx playwright install chromium   # first time only
npx playwright test
```

You don't need to start the app yourself first: `playwright.config.ts` boots both `dotnet run`
(`Triviador.Web`, port 5106) and `npm run dev` (`Triviador.Client`, port 5173) if they aren't already
running. If you already have the usual two-terminal dev loop going (per the root `CLAUDE.md`), the
suite detects both ports are live and reuses them instead of starting duplicates.

`@playwright/test` is pinned to `1.61.0`, the last release supporting Node 18 (this repo's pinned
Node version, `v18.20.2` - the same reason `Triviador.Client` is pinned to Vite 5). Upgrading Node
would let this move to a current Playwright release too.

## Coverage

Every scenario in `openspec/specs/room-lobby/spec.md` is covered **except**:

- **Idle rooms are eventually removed.** `RoomOptions.IdleThreshold` defaults to 15 minutes and is
  hardcoded in `Program.cs` (`new RoomOptions()`), not read from configuration. Automating this
  would mean either a multi-minute test (a bad trade for a suite meant to run routinely) or a
  production code change to make the threshold configurable (out of scope for this change). This is
  a deliberate, documented gap, not an oversight - revisit if `RoomOptions` ever gains a
  configuration-driven threshold.

## Notes on approach

- No `data-testid` attributes were added to `LandingScreen`/`LobbyScreen`. Every scenario is reachable
  through the roles, placeholders, and visible text already there.
- Multi-seat scenarios use multiple Playwright `page`s (tabs) inside one `browserContext`, mirroring
  the real "one browser window, several tabs" manual test loop described in the root `CLAUDE.md` -
  `sessionStorage` (and therefore seat identity) is genuinely per-tab, so this is the same isolation
  boundary a real four-player local test uses.
- A dropped connection is simulated with `page.close()`, which drops the page's WebSocket the same
  way a closed browser tab does for a real player.
- The "unknown/stale token" scenario seeds `sessionStorage` directly (via `page.addInitScript`)
  rather than scripting a raw SignalR call, so it exercises the real client auto-join path
  (`App.tsx`) exactly as a returning player with a corrupted or expired session would.
