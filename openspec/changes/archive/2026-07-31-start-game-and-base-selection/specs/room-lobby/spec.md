## ADDED Requirements

### Requirement: Starting a game requires at least two occupied seats
The host SHALL be able to start the game only when at least 2 of the room's 4 seats are occupied
(human or bot). Starting SHALL transition the room out of the lobby.

#### Scenario: Host starts with enough seats filled
- **WHEN** the host starts the game with 2 or more seats occupied
- **THEN** the room transitions out of the lobby and every occupied seat begins playing

#### Scenario: Host cannot start with only one seat filled
- **WHEN** the host attempts to start the game with fewer than 2 seats occupied
- **THEN** the request is rejected and the room remains in the lobby

### Requirement: Seat occupancy locks once the game starts
Once a room has started a game, no seat's occupant SHALL change: the host can no longer toggle a
seat between bot and open, and each seat's occupant (bot or human) at the moment the game starts is
who plays that seat for the rest of the game.

#### Scenario: Bot-seat toggle is no longer available mid-game
- **WHEN** a game has started
- **THEN** the host is no longer offered any control to change a seat's occupant
