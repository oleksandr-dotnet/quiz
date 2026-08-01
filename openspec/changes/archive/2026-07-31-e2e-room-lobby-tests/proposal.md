## Why

The `room-lobby` capability (create/join a room, seats, bot toggles, disconnect/reconnect,
host reassignment) is implemented and archived, but has never been exercised against a real running
game — only manually, per its change's `tasks.md`. `tests/` has been reserved for exactly this since
M0 ("end-to-end tests only, driven through Playwright against a running game, added when there's a
real flow worth covering that way") and has sat empty. `room-lobby` is the first flow stable enough
to be worth locking down this way: a regression here (a seat not freeing, a stale token creating a
duplicate seat, a non-host sneaking a bot toggle through) would be silent and hard to catch by eye
once gameplay phases start landing on top of it.

## What Changes

- Add the first real content under `tests/`: a standalone npm project at `tests/e2e` (its own
  `package.json`, no `.csproj` — same "bare package.json" pattern `src/Triviador.Client` already
  uses, so `dotnet build` stays untouched by it) with `@playwright/test`.
- Add `playwright.config.ts` with two `webServer` entries — `dotnet run` for `Triviador.Web` on
  `:5106` (readiness via `GET /api/health`) and `npm run dev` for `Triviador.Client` on `:5173` —
  both with `reuseExistingServer: true` so the suite reuses whatever dev loop is already running in
  another terminal instead of fighting it for the port, `baseURL` set to the Vite port per the
  project's own rule of never hitting `:5106` directly.
- Add a Playwright spec suite covering every scenario in `openspec/specs/room-lobby/spec.md` except
  idle-room eviction (see Impact) — create room, join by code, room-not-found/room-full rejections,
  host bot-seat toggling (and the non-host rejection), the "Play vs 3 bots" quick-start, refresh
  reclaiming a seat via the `sessionStorage` token, an unknown/stale token falling back to a normal
  join, a dropped connection showing as disconnected without freeing the seat, leaving freeing a
  seat, and host reassignment (to another human, and the no-host-until-a-human-returns case for an
  otherwise bot-only room).
- Multi-seat scenarios use multiple Playwright pages inside one browser context — mirroring the
  real "one browser window, several tabs" manual test loop `CLAUDE.md` already documents, since
  `sessionStorage` (and therefore seat identity) is genuinely per-tab.
- No changes to application code: the UI has no `data-testid` hooks today and none are being added:
  every scenario is reachable through visible text, placeholders, and ARIA roles already on
  `LandingScreen`/`LobbyScreen`.

## Capabilities

### New Capabilities
- `e2e-test-tooling`: the E2E test project's own existence and scope — that it runs against a real
  built game via Playwright, boots both dev servers itself (or reuses running ones), and states
  plainly what it does and does not cover for the `room-lobby` capability.

### Modified Capabilities
(none — `room-lobby`'s own requirements are unchanged; this change only adds verification of them)

## Impact

- Affected code: new `tests/e2e/**` only. No `Triviador.Domain`/`Application`/`Infrastructure`/`Web`/
  `Client` production code changes.
- **Idle-room eviction is intentionally not covered.** `RoomOptions.IdleThreshold` defaults to 15
  minutes and is hardcoded in `Program.cs` (`new RoomOptions()`), not read from configuration, so
  there is no way to shorten it for a test run without either a production code change (out of
  scope here) or a multi-minute-long E2E test (a bad trade for a suite meant to run routinely). This
  is recorded as a known gap in `design.md`, not silently skipped.
- `dotnet build`/`dotnet publish` are unaffected: `tests/e2e` has no `.csproj` and isn't referenced
  by `Triviador.sln`, mirroring how `Triviador.Client` stays outside the solution's own build graph.
