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
