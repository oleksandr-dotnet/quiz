## MODIFIED Requirements

### Requirement: An unresponsive turn resolves on its own
A base SHALL be picked automatically for the current picker if they do not pick one before their
deadline, so the game is never stuck waiting on one seat. A bot seat SHALL NOT rely on this
fallback in the normal case: per `bot-gameplay`, a bot actively submits its own `SelectBase` choice
before the deadline. This fallback remains the resolution path for a disconnected or unresponsive
human, and remains a bot's own safety net if its scheduled submission is somehow not accepted in
time.

#### Scenario: A bot's turn to pick a base
- **WHEN** it becomes a bot seat's turn to pick a base
- **THEN** the bot submits its own base choice before the deadline in the normal case; a base is
  still picked automatically once the deadline passes if, for any reason, the bot has not acted by
  then

#### Scenario: A disconnected human's turn to pick a base
- **WHEN** the current picker is a human seat that is disconnected
- **THEN** a base is picked for it automatically once the turn's deadline passes
