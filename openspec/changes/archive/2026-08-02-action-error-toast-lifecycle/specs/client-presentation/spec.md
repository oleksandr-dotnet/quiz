## ADDED Requirements

### Requirement: An action-rejection toast dismisses on its own
The client SHALL automatically dismiss the in-game action-rejection toast after a fixed delay,
independent of whether the current actor (picker/attacker/question) changes in the meantime.

#### Scenario: The rejection toast disappears on its own
- **WHEN** an action is rejected and the current actor does not change afterward
- **THEN** the rejection toast disappears on its own after a fixed delay rather than persisting
  indefinitely

#### Scenario: A new rejection while one is still showing still eventually clears
- **WHEN** the current actor changes while a rejection toast is still showing
- **THEN** the toast still clears (as it already did), and a subsequent rejection gets its own
  fresh dismiss timer
