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
A base SHALL be picked automatically for the current picker (a bot, or a human who does not act) if
they do not pick one before their deadline, so the game is never stuck waiting on one seat.

#### Scenario: A bot's turn to pick a base
- **WHEN** it becomes a bot seat's turn to pick a base
- **THEN** a base is picked for it automatically once the turn's deadline passes, with no player input

#### Scenario: A disconnected human's turn to pick a base
- **WHEN** the current picker is a human seat that is disconnected
- **THEN** a base is picked for it automatically once the turn's deadline passes, the same as a bot

### Requirement: Every player sees whose turn it is and the map's current state
While base picking is underway, every player SHALL see who is currently picking, the time remaining
for that pick, which regions are already claimed and by whom, and which regions are currently
eligible for the current picker to choose - the same information for every viewer, since nothing
about base selection is secret.

#### Scenario: Watching another player's turn
- **WHEN** it is not a player's own turn to pick
- **THEN** they still see who is picking, the remaining time, and the map's current ownership, but
  cannot pick a region themselves

#### Scenario: The eligible region set is visible to everyone, not just the current picker
- **WHEN** it is a player's turn to pick a base
- **THEN** every viewer's `GameView` carries the same set of region ids that are currently eligible
  for that pick, computed the same way the engine itself validates a pick

#### Scenario: The eligible set reflects the distance-constraint waiver
- **WHEN** every remaining unowned region is too close to an existing base, so the minimum-distance
  constraint is waived for the current pick
- **THEN** the projected eligible-region set includes every remaining unowned region, matching what
  the engine will actually accept

### Requirement: Base selection's end flows directly into land grab
Once every occupied seat has picked a base, every player SHALL be shown the land-grab phase beginning
- a question being asked to every active player - with no intervening "waiting" or dead-end state.

#### Scenario: All bases are picked
- **WHEN** the last occupied seat picks its base
- **THEN** every player's view transitions directly to the first land-grab question, with no
  "complete" or "not built yet" state shown in between

