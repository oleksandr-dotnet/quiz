## ADDED Requirements

### Requirement: A seat converted to bot control mid-activity is scheduled immediately, not on the next transition
A seat that becomes bot-controlled while a pending activity already requires its input SHALL have a
bot move scheduled for that same pending activity right away, using the same eligible-choice
derivation and human-paced delay any other bot move uses - not only starting from the next pending
activity.

#### Scenario: A newly bot-controlled seat's current turn is still scheduled
- **WHEN** a seat becomes bot-controlled while it is the current actor on a pending base pick,
  land-grab pick, attack-target selection, or an unanswered question participant
- **THEN** a bot move for that same pending activity is scheduled immediately, exactly as it would be
  had the seat already been bot-controlled when the activity began
