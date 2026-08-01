## 1. Project scaffold

- [x] 1.1 Create `tests/e2e/package.json` (bare npm project, no `.csproj`) with `@playwright/test` as
      a dev dependency and a `test` script running `playwright test`.
- [x] 1.2 Create `tests/e2e/tsconfig.json` for the spec files (or rely on Playwright's default
      TS support if a config isn't needed).
- [x] 1.3 Create `tests/e2e/.gitignore` covering `node_modules/`, `test-results/`,
      `playwright-report/`, `playwright/.cache/`.
- [x] 1.4 `npm install` in `tests/e2e`, then `npx playwright install chromium` (or the full default
      set) so the suite can actually launch a browser.

## 2. Playwright configuration

- [x] 2.1 Add `tests/e2e/playwright.config.ts`: `testDir: './specs'`, `baseURL:
      'http://localhost:5173'`, an array `webServer` with two entries (`dotnet run --project
      src/UI/Triviador.Web/Triviador.Web.csproj` cwd'd at the repo root, url
      `http://localhost:5106/api/health`; `npm run dev` cwd'd at `src/Triviador.Client`, url
      `http://localhost:5173`), both `reuseExistingServer: true`, reasonable startup `timeout`s.
- [x] 2.2 Single `chromium` project is enough for this suite (no cross-browser requirement stated).

## 3. Test helpers

- [x] 3.1 Add a small helpers module (e.g. `tests/e2e/specs/helpers.ts`) with: `createRoom(page,
      name, botSeats)`, `joinRoomByCode(page, code, name)`, `roomCodeOf(page)` (reads the "Room
      XXXX" heading), a seat-row locator helper, and the room-code alphabet regex
      (`/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/`) for the code-format assertion.

## 4. Room creation and joining

- [x] 4.1 Test: creating a room seats the creator as host and returns a valid 4-character code
      (matches the alphabet regex; excludes `I`/`O`/`0`/`1` by construction).
- [x] 4.2 Test: a second tab joining by that code is seated, and the first tab's seat list updates to
      show the new player.
- [x] 4.3 Test: joining a code that doesn't match any room is rejected with a distinguishable error
      shown to the user, and no seat is taken.
- [x] 4.4 Test: joining a room whose 4 seats are all occupied (fill via "Play vs 3 bots" then have a
      4th human join, then a 5th attempt) is rejected with a distinguishable "room full" error.

## 5. Seats: bots and host control

- [x] 5.1 Test: the host converts an open seat to a bot, and every connected tab in the room sees the
      updated seat list; converting it back to open works too.
- [x] 5.2 Test: a non-host player's attempt to toggle a seat has no effect on the seat list.
- [x] 5.3 Test: "Play vs 3 bots" creates a room with the creator as host and the other 3 seats
      immediately occupied by bots.

## 6. Identity, reconnection, and disconnection

- [x] 6.1 Test: refreshing the page (reload, same tab) reclaims the same seat rather than creating a
      new one — assert seat count and the player's own seat identity are unchanged after reload.
- [x] 6.2 Test: seeding `sessionStorage` with a valid room code but a token that matches no seat, then
      loading the page, results in a normal new join (an open seat is taken) rather than an error.
- [x] 6.3 Test: closing one tab's page (simulating a dropped connection) causes every remaining tab to
      see that seat marked disconnected, without freeing or reassigning it.

## 7. Leaving and host reassignment

- [x] 7.1 Test: a seated (non-host) player explicitly leaving frees their seat, visible to the
      remaining players.
- [x] 7.2 Test: the host explicitly leaving while another connected human remains reassigns host
      status to one of them, and that player can now toggle bot seats.
- [x] 7.3 Test: the host explicitly leaving an otherwise bot-only room leaves the room with no host;
      document (in a code comment or the spec) that host status returns only once a human next joins
      — reaching full confidence on the "human rejoin restores a host" half of this would require a
      second full join, which 7.2/4.2 already exercise, so this test only needs to assert the
      no-host state.

## 8. Documentation

- [x] 8.1 Add a short `tests/e2e/README.md` (or extend `tests/README.md`) stating how to run the
      suite (`npm install && npx playwright test` from `tests/e2e`, with or without a dev loop
      already running), and explicitly naming idle-room eviction as the one `room-lobby` scenario
      not covered and why.

## 9. Verification

- [x] 9.1 Run the full suite locally (`npx playwright test` from `tests/e2e`) against a live
      `dotnet run` + `npm run dev`, fix anything red, and confirm every test in tasks 4-7 passes.
- [x] 9.2 Confirm `dotnet build` at the repo root is unaffected (no new project reference, no
      `Triviador.sln` change required by this suite).
- [x] 9.3 Confirm `git status` shows changes scoped to `tests/e2e/**` (and `tests/README.md` if
      extended) plus `openspec/` — no application code touched.
