## ADDED Requirements

### Requirement: Every player sees the game settings before start, only the host can change them
While a room is in its lobby, every seated player's view SHALL show the current state of the three
game-mechanic toggles (answer streaks, category ban draft, golden question), all defaulting to
enabled. Only the host SHALL be able to change them; a change SHALL be reflected in every seated
player's view immediately.

#### Scenario: A newly joined player sees the current settings
- **WHEN** a player joins a room already showing non-default settings
- **THEN** their view reflects the room's current toggle values, not the defaults

#### Scenario: A host's change is broadcast to everyone
- **WHEN** the host changes a toggle before starting the game
- **THEN** every seated player's view updates to reflect the new value

#### Scenario: A non-host sees the settings but cannot change them
- **WHEN** a non-host player attempts to change a toggle
- **THEN** the room's settings are unchanged and every player's view remains as it was
