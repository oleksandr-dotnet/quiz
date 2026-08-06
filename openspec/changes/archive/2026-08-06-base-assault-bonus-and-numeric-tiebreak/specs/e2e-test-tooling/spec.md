## ADDED Requirements

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
