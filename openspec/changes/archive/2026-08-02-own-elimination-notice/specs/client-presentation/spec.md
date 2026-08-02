## ADDED Requirements

### Requirement: The viewer's own elimination gets a distinct proclamation
When a `playerEliminated` transition names the viewer's own player id, the client SHALL display a
visible proclamation acknowledging the viewer's own elimination, distinct from the shared
base-falls proclamation shown to every viewer when any base is captured.

#### Scenario: The viewer is told they were eliminated
- **WHEN** a snapshot produces a `playerEliminated` transition whose `playerId` equals
  `view.youPlayerId`
- **THEN** the client displays a proclamation acknowledging the viewer's own elimination

#### Scenario: Another player's elimination does not show the viewer's own-elimination proclamation
- **WHEN** a snapshot produces a `playerEliminated` transition whose `playerId` is not
  `view.youPlayerId`
- **THEN** the client does not display the viewer's own-elimination proclamation for that
  transition (the existing base-falls proclamation, shown to every viewer, is unaffected)
