# e2e-test-tooling Specification

## Purpose
Describes what the end-to-end test suite itself must be: exercising the real running game through
a real browser (not mocks), transparent about what it does and doesn't cover, and matching the
per-tab identity model the actual client relies on.
## Requirements
### Requirement: The E2E suite runs against a real running game
The end-to-end test project SHALL exercise the actual `Triviador.Web` host and `Triviador.Client`
build through a real browser, not a mocked server or a component-level render. It SHALL be able to
boot both processes itself when they are not already running, and SHALL reuse them when they are.

#### Scenario: Suite boots its own dev servers
- **WHEN** the E2E suite is run and neither the API host nor the Vite dev server is already
  listening on its configured port
- **THEN** the suite starts both before running any test and tears them down afterward

#### Scenario: Suite reuses an already-running dev loop
- **WHEN** the E2E suite is run while a developer already has `dotnet watch` and `npm run dev`
  running in other terminals
- **THEN** the suite detects both are already listening and runs its tests against them without
  starting duplicate processes

### Requirement: The suite states its own coverage boundary
The E2E suite SHALL make explicit which scenarios of the capability it covers it does and does not
exercise, rather than leaving a gap silently indistinguishable from an oversight.

#### Scenario: A scenario excluded for practicality is documented, not silently absent
- **WHEN** a scenario from a covered capability's spec is not automated because doing so is
  impractical (for example, a real-time delay too long for a routine test run)
- **THEN** the suite's documentation names the scenario and states why it is excluded

### Requirement: Multi-seat scenarios use independent per-tab sessions
Scenarios that need more than one seated player SHALL simulate distinct browser tabs with
independent session identity, matching how the real client distinguishes seats (a per-tab
`sessionStorage` token) — not a single shared page acting as multiple players.

#### Scenario: Two seats in one test use two tabs
- **WHEN** a test scenario needs two distinct seated players in the same room
- **THEN** it drives them through two separate browser tabs (pages) sharing one browser context,
  each with its own session identity, rather than reusing one page for both

### Requirement: The suite pins its own UI language regardless of the app's default
The E2E suite SHALL fix the client's UI language to a known value before any test interacts with
the page, rather than relying on whichever language the app would otherwise default to. The app's
own default locale is a product decision that may change independently of this suite.

#### Scenario: A test asserting UI text is unaffected by the app's real default locale
- **WHEN** any test navigates to the landing page through the suite's shared navigation helper
- **THEN** the page renders in the language the suite pinned, regardless of what the app would have
  defaulted to on a fresh visit with no stored preference

### Requirement: The suite can target an already-running deployment instead of local dev servers
When an `E2E_BASE_URL` environment variable is set, the suite SHALL use it as the base URL for every
test and SHALL NOT attempt to boot or reuse local `dotnet run`/`npm run dev` processes. When
`E2E_BASE_URL` is unset, behavior is unchanged from the local dev-loop mode this suite already
supports (boot or reuse `localhost:5106`/`5173`).

#### Scenario: Running against production
- **WHEN** the suite is invoked with `E2E_BASE_URL` set to a deployed environment's URL
- **THEN** every test navigates against that URL, and no local server process is started or expected

#### Scenario: Running locally is unaffected
- **WHEN** the suite is invoked with no `E2E_BASE_URL` set
- **THEN** the suite boots or reuses the local dev-loop servers exactly as it already does today

### Requirement: A scenario needing many real-time turns uses the smallest game that still reaches it
A scenario whose coverage requires advancing many Battle-phase rounds (for example, reaching
`GameRules.BaseAssaultUnlockRound`) SHALL use the minimum player count the rule under test allows
(`GameRules.MinPlayers`, no bot seats) and SHALL submit every answer immediately rather than waiting
out any deadline, so the scenario's run time is dominated only by unavoidable fixed waits (the
`RevealHold` window), not by avoidable player count or timing slack.

#### Scenario: A round-8-dependent scenario runs with the minimum player count
- **WHEN** a scenario needs to reach a round gated by `GameRules.BaseAssaultUnlockRound`
- **THEN** it drives a two-player game (no bot seats) rather than the default four-seat game, and
  every question is answered as soon as it appears

