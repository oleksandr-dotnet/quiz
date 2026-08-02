## MODIFIED Requirements

### Requirement: Seat occupancy locks once the game starts
Once a room has started a game, no seat's occupant identity SHALL change: the host can no longer
toggle a seat between bot and open, and each seat's occupant (bot or human) at the moment the game
starts is who plays that seat for the rest of the game. The one exception is an explicit mid-game
leave (see `player-leave-and-takeover`): a human seat's *control mode* may change to bot-controlled
via that action, but the seat's underlying player identity never changes, and no other mechanism -
host toggle, disconnection alone, or timeout - changes a seat's occupant or control mode mid-game.

#### Scenario: Bot-seat toggle is no longer available mid-game
- **WHEN** a game has started
- **THEN** the host is no longer offered any control to change a seat's occupant

#### Scenario: An explicit leave is the only mid-game path from human to bot control
- **WHEN** a game has started
- **THEN** a seat's control mode changes from human to bot only if that seat's player explicitly
  leaves the game (per `player-leave-and-takeover`), never through the host's now-unavailable toggle,
  a dropped connection alone, or any other action
