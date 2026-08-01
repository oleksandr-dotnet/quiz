## MODIFIED Requirements

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
