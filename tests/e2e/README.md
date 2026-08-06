# tests/e2e

Playwright end-to-end tests, driven against a real running `Triviador.Web` + `Triviador.Client`
through a real browser. This is the first content in `tests/` (see `tests/README.md`) - it covers
the `room-lobby` capability (`openspec/specs/room-lobby/spec.md`), the mid-game kick flow, and (as of
`base-assault-bonus-and-numeric-tiebreak`) the base-assault score bonus and the numeric-tiebreak duel
rework.

## Running locally

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

## Running against a deployed environment (e.g. production)

Set `E2E_BASE_URL` to skip booting local dev servers entirely and drive the suite against an
already-running deployment instead:

```powershell
$env:E2E_BASE_URL = 'https://quiz-l0e2.onrender.com'
npx playwright test
```

The GitHub Action `.github/workflows/e2e-production.yml` runs exactly this, against the same URL by
default. It's manually triggered (`workflow_dispatch`), not run on every push - some scenarios here
(see below) legitimately take several real minutes, which is a poor fit for a per-commit gate. Trigger
it from the Actions tab, or `gh workflow run e2e-production.yml`.

## Coverage

Every scenario in `openspec/specs/room-lobby/spec.md` is covered **except**:

- **Idle rooms are eventually removed.** `RoomOptions.IdleThreshold` defaults to 15 minutes and is
  hardcoded in `Program.cs` (`new RoomOptions()`), not read from configuration. Automating this
  would mean either a multi-minute test (a bad trade for a suite meant to run routinely) or a
  production code change to make the threshold configurable (out of scope for this change). This is
  a deliberate, documented gap, not an oversight - revisit if `RoomOptions` ever gains a
  configuration-driven threshold.

`battle-numeric-tiebreak.spec.ts` and `battle-base-assault-bonus.spec.ts` cover
`base-assault-bonus-and-numeric-tiebreak`'s two features end to end, against a real running game:

- **Numeric tiebreak** (`battle-numeric-tiebreak.spec.ts`): drives a deliberately minimal two-player
  game (no bots) into Battle, forces a Choice-kind duel to tie on correctness (both combatants answer
  correctly, read from `specs/question-bank.ts`'s content-bank lookup - never a live secret channel),
  and asserts the resulting numeric tiebreak is decided by closeness even when the closer answer is
  slower, then asserts an equally-close tiebreak (both exactly correct) falls back to elapsed time.
- **Base-assault score bonus** (`battle-base-assault-bonus.spec.ts`): drives the same kind of minimal
  two-player game all the way to `GameRules.BaseAssaultUnlockRound` (round 8) and one resolved
  base-assault question against a full-health base, asserting both players' scores move by exactly
  `+/-200` with no territory change to confound the read. This is the slower of the two new specs
  (reaching round 8 takes real minutes even minimized - see this change's design.md) and is the reason
  `battle-*` specs are a poor fit for a per-commit gate; run them routinely via the production
  workflow above instead, or locally when touching battle-flow code.

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
- `specs/question-bank.ts` reads `src/UI/Triviador.Web/Data/questions/{choice,tip}/*.json` directly -
  the same static content the server loads from disk - so a test can submit a deterministically
  correct answer without ever touching a live secret channel (the server never sends the correct
  answer to a client before a question resolves, by design). This works unchanged against a
  production target too, since it serves the same content baked into the same deployed build.
- The two `battle-*` specs use a deliberately minimal two-player game (no bot seats) and answer every
  question the instant it appears, per `openspec/specs/e2e-test-tooling/spec.md`'s "smallest game
  that still reaches it" requirement - see `helpers.ts`'s `fastForwardUntil`/`fastForwardToBattle`.
