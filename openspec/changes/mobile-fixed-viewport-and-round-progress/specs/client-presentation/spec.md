## ADDED Requirements

### Requirement: Battle shows rounds remaining, not just the current round number
Whenever the client displays the current round number (Battle phase only, since round tracking has no meaning before Battle begins), it SHALL also display the round limit and the number of rounds remaining.

#### Scenario: The round display includes current, total, and remaining
- **WHEN** the client is in the `Battle` phase and renders the round indicator
- **THEN** the indicator shows the current round number, the round limit, and the number of rounds
  remaining (round limit minus current round, floored at zero)

#### Scenario: The round display does not appear outside Battle
- **WHEN** the client is in `BaseSelection`, `LandGrab`, or `Finished`
- **THEN** no round-progress indicator is shown, matching `currentRound`'s lack of meaning in those
  phases
