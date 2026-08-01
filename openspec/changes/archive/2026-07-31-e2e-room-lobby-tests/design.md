## Context

`tests/` has held only a `README.md` since M0, stating the deliberate choice to skip unit/integration
test projects and reserve this folder for Playwright E2E once a flow is worth covering. `room-lobby`
(create/join, seats, bot toggles, disconnect/reconnect, host reassignment) is that first flow: fully
implemented, archived, and specified in `openspec/specs/room-lobby/spec.md`. This change adds the
suite and nothing else — no application code changes, no new UI hooks.

## Goals / Non-Goals

**Goals:**
- A `tests/e2e` npm project, structurally separate from `Triviador.sln` and from `Triviador.Client`,
  that a developer or CI can point at a running game and get a pass/fail signal for every
  `room-lobby` scenario that's practical to automate.
- Tests written against the real DOM the app already renders (roles, placeholders, visible text) —
  zero new `data-testid` attributes added to `LandingScreen`/`LobbyScreen` for this change.
- Multi-tab scenarios (disconnect, host reassignment, refresh-reclaims-seat) driven through genuinely
  separate Playwright pages in one browser context, since `sessionStorage` is per-tab and that's
  exactly the identity boundary the feature relies on.

**Non-Goals:**
- Idle-room eviction (15-minute default, not configurable without a production code change — see
  proposal's Impact section).
- Any gameplay-phase coverage (`BaseSelection`, `LandGrab`, `Battle`) — none of it exists yet.
- Visual regression / screenshot testing — out of scope, this is behavioral coverage only.
- CI wiring (a GitHub Actions workflow, etc.) — not requested; this change only makes the suite
  runnable locally via `npx playwright test` from `tests/e2e`.

## Decisions

**Location and shape: `tests/e2e/`, a bare npm project, no `.csproj`.** Mirrors
`src/Triviador.Client`'s own justification for staying out of `Triviador.sln` (keeps `dotnet build`
sub-second and untouched by Node tooling). `tests/README.md` already scoped this folder to
"Playwright E2E... driven through Playwright against a running game" — this is that, literally.

**`playwright.config.ts` owns both dev servers via an array `webServer` config, both
`reuseExistingServer: true`.** Playwright's `webServer` accepts an array since 1.28. Unconditional
`reuseExistingServer: true` (not gated on `!process.env.CI`) is a deliberate choice for this repo:
there is no CI pipeline today, and the common case is a developer already running
`dotnet watch`/`npm run dev` in two terminals per `CLAUDE.md`'s own dev loop — the suite should slot
into that, not fight it for a port. If a CI pipeline is added later, this line is the one to revisit
(the standard `!process.env.CI` guard would then start forcing a fresh boot in CI while still
reusing locally).

**No new `data-testid` attributes.** Every scenario in scope is reachable through role/text/
placeholder locators already present (`getByPlaceholder('Your name')`, `getByRole('button', { name:
'Create room' })`, seat rows read from `.seat-list li` text content). Adding test hooks to
production markup for a first test suite would be solving a problem that doesn't exist yet; revisit
only if a specific scenario turns out to be unreliable to locate this way.

**Multi-seat tests use multiple `page`s in one `browserContext`, not multiple `browserContext`s.**
This matches the real "four tabs in one ordinary browser window" scenario `CLAUDE.md` documents for
manual testing exactly: separate pages (tabs) in the same context get independent `sessionStorage`
(per-tab by spec) while still being the same "browser session" a real player would open. Using
separate contexts would also achieve seat isolation but would test a scenario (separate browser
profiles) the app was never designed around.

**Disconnection is simulated via `page.close()`.** Closing a Playwright page drops its WebSocket the
same way a closed browser tab does in real use, which is exactly what `OnDisconnectedAsync` /
`ConnectionLost` in `RoomActor` is built to react to — no need for a fake network-drop mechanism.

**The "unknown token falls back to a normal join" scenario is driven through the real auto-join
path, not a raw hub call.** `App.tsx`'s effect calls `joinRoom(roomCode, name, session.playerToken)`
whenever a `sessionStorage` session exists on load. Seeding `sessionStorage` with a room code that
exists but a `playerToken` that doesn't, then loading the page, exercises the exact code path
(`RoomActor.HandleJoinAsync`'s "Unknown token: fall through" branch) a real corrupted/expired session
would hit — no need to script a direct SignalR invocation from the test.

## Risks / Trade-offs

- **Playwright browser binaries add real install weight** → Mitigation: `tests/e2e` is entirely
  separate from `Triviador.Client`'s `node_modules`, so this cost is paid once, only by whoever runs
  the suite, and never touches the app's own dependency tree or build.
- **Tests share one live server process, not a fresh instance per test** → Mitigation: every test
  creates its own room via a fresh join code, so tests don't collide on state; `RoomOptions.MaxRooms`
  (200) is far above what one suite run creates.
- **No CI wiring means the suite can silently rot** → Accepted for this change: the ask was the
  suite itself; wiring it into a CI step is a natural, separable follow-up once one exists for this
  repo at all.
- **Idle-room eviction has no automated coverage** → Mitigation: documented explicitly (per the new
  `e2e-test-tooling` requirement that coverage gaps are stated, not silent) rather than worked around
  with a fragile long-running test.

## Migration Plan

Not applicable — purely additive, no existing behavior changes, nothing to roll back beyond deleting
the new directory.

## Open Questions

None outstanding — scope, locators, and server-boot strategy are all settled above.
