# base-selection-flow Specification

## Purpose
Once a game starts, every seated player (human or bot) takes a turn picking one region of the map as
their base, in seat order, so the conquest phase that follows has a starting point for everyone.
## Requirements
### Requirement: Base picking proceeds in seat order
Once the game starts, each occupied seat SHALL be asked, in seat order, to pick one region of the map
as its base. A pick SHALL be rejected if the region is already owned by another seat, or if it is too
close to an already-chosen base.

#### Scenario: A player picks a valid base
- **WHEN** it is a player's turn to pick a base and they choose an unowned region far enough from
  every existing base
- **THEN** that region becomes their base and the turn passes to the next occupied seat

#### Scenario: A pick too close to an existing base is rejected
- **WHEN** a player attempts to pick a region too close to an already-chosen base
- **THEN** the pick is rejected and it remains that player's turn

#### Scenario: A pick out of turn is rejected
- **WHEN** a player who is not the current picker attempts to pick a base
- **THEN** the pick is rejected and the current picker's turn is unaffected

### Requirement: An unresponsive turn resolves on its own
If the current picker (a bot, or a human who does not act) does not pick a base before a deadline, a
base SHALL be picked for them automatically so the game is never stuck waiting on one seat.

#### Scenario: A bot's turn to pick a base
- **WHEN** it becomes a bot seat's turn to pick a base
- **THEN** a base is picked for it automatically once the turn's deadline passes, with no player input

#### Scenario: A disconnected human's turn to pick a base
- **WHEN** the current picker is a human seat that is disconnected
- **THEN** a base is picked for it automatically once the turn's deadline passes, the same as a bot

### Requirement: Every player sees whose turn it is and the map's current state
While base picking is underway, every player SHALL see who is currently picking, the time remaining
for that pick, and which regions are already claimed and by whom - the same information for every
viewer, since nothing about base selection is secret.

#### Scenario: Watching another player's turn
- **WHEN** it is not a player's own turn to pick
- **THEN** they still see who is picking, the remaining time, and the map's current ownership, but
  cannot pick a region themselves

### Requirement: Base selection's end is visible even though the next phase isn't built yet
Once every occupied seat has picked a base, every player SHALL be clearly shown that base selection is
complete, without the game silently doing nothing or appearing stuck.

#### Scenario: All bases are picked
- **WHEN** the last occupied seat picks its base
- **THEN** every player is shown that base selection is complete

