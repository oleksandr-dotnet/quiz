## ADDED Requirements

### Requirement: Landing and Lobby remain scrollable when their content exceeds the viewport
The client SHALL NOT apply the in-game fitted-viewport's document-level scroll lockout to the
landing screen or the lobby screen — neither renders the gameplay shell the lockout exists to
backstop, and both are expected to scroll normally on any viewport short enough that their content
doesn't fit, including short-landscape phones.

#### Scenario: The Join Room button remains reachable on a short landscape viewport
- **WHEN** the viewport is short enough (landscape or otherwise) that the landing screen's content
  is taller than the visible viewport
- **THEN** the document remains scrollable and the Join Room button can be reached by scrolling

#### Scenario: The Start Game button remains reachable on a short landscape viewport
- **WHEN** the viewport is short enough that the lobby screen's content is taller than the visible
  viewport
- **THEN** the document remains scrollable and the Start Game button can be reached by scrolling

#### Scenario: The in-game no-scroll behavior is unaffected
- **WHEN** a gameplay phase (`BaseSelection`, `LandGrab`, `Battle`, `Finished`) is active
- **THEN** the document-level scroll lockout still applies exactly as before, with no regression to
  the existing "game screen fits the viewport without scrolling" requirement
