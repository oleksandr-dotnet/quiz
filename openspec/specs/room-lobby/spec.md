# room-lobby Specification

## Purpose
Lets 1-4 players gather in a shared room before a game starts, with bots filling any seats no human
has taken, so a game is always startable without waiting on other people.
## Requirements
### Requirement: Create a room
A player SHALL be able to create a new room and receive a short, unambiguous join code for it. The
creating player SHALL be seated in the room as its host.

#### Scenario: Successful creation
- **WHEN** a player requests to create a room
- **THEN** a new room is created with that player seated as host, and a 4-character join code is
  returned that contains no visually ambiguous characters (no `I`, `O`, `0`, or `1`)

### Requirement: Join a room by code
A player SHALL be able to join an existing room by its join code, taking the first open seat. Joining
SHALL fail with a specific, distinguishable reason when the code does not match a room, the room is
full, or the room's game has already started.

#### Scenario: Successful join
- **WHEN** a player submits a valid code for a room with at least one open seat and no game in
  progress
- **THEN** the player is seated in the room and every other player in the room is shown the updated
  seat list

#### Scenario: Room not found
- **WHEN** a player submits a code that does not match any room
- **THEN** the join is rejected with a "room not found" reason and no seat is taken

#### Scenario: Room full
- **WHEN** a player submits a valid code for a room whose 4 seats are all occupied
- **THEN** the join is rejected with a "room full" reason

### Requirement: Seats hold either a connected human or a bot
Each room SHALL have exactly 4 seats. Each seat SHALL be in exactly one of these states at any time:
occupied by a connected human, occupied by a bot, or open (unoccupied, awaiting a human or a host
toggle to a bot). The host SHALL be able to toggle any seat that is not occupied by a connected human
between "open" and "bot".

#### Scenario: Host converts an open seat to a bot
- **WHEN** the host toggles an open seat to "bot"
- **THEN** that seat is immediately occupied by a bot and every player in the room sees the updated
  seat list

#### Scenario: Non-host cannot toggle seats
- **WHEN** a non-host player attempts to toggle a seat
- **THEN** the request is rejected and no seat changes

### Requirement: Quick-start against bots
A player SHALL be able to create a room where every seat besides their own is immediately a bot,
without a separate step to toggle each seat individually.

#### Scenario: Play vs 3 bots
- **WHEN** a player chooses the bot quick-start
- **THEN** a room is created with that player as host and the other 3 seats occupied by bots

### Requirement: Player identity survives a page refresh
On first joining a room, a player SHALL receive an identifier that, when presented again to the same
room, reclaims the same seat rather than taking a new one or being treated as a new player.

#### Scenario: Reclaiming a seat after a refresh
- **WHEN** a player who already holds a seat rejoins the same room presenting their identifier from
  the first join
- **THEN** they are reconnected to their existing seat with its current state, and no additional seat
  is created or consumed

#### Scenario: Unknown identifier is treated as a new join
- **WHEN** a join request presents an identifier that does not match any seat in the target room
- **THEN** the request is handled as a normal new join (subject to the room having an open seat)

### Requirement: Disconnection is visible but non-blocking
When a connected human seat loses its connection, the room SHALL continue to exist and SHALL mark that
seat as disconnected in what every other player sees, without freeing or reassigning the seat.

#### Scenario: A player's tab closes or loses network
- **WHEN** a connected human seat's connection drops
- **THEN** that seat is shown to every remaining player as disconnected, and the room's other seats
  are unaffected

### Requirement: Leaving a room frees the seat
A player SHALL be able to explicitly leave a room they are seated in while it has not started a game.
Doing so SHALL make that seat open again.

#### Scenario: A seated player leaves before the game starts
- **WHEN** a seated player explicitly leaves the room
- **THEN** their seat becomes open and every remaining player sees the updated seat list

### Requirement: Host reassigns when the host leaves
A room SHALL always have at most one host among its connected human seats. When the current host
leaves and at least one other connected human seat remains, host status SHALL pass to one of them so
bot-seat toggling stays available. When no connected human seat remains, the room SHALL have no host
until a human is seated again.

#### Scenario: Host leaves while another human is seated
- **WHEN** the host explicitly leaves a room that has at least one other connected human seat
- **THEN** one of the remaining connected human seats becomes the new host, and that player can now
  toggle bot seats

#### Scenario: Host leaves an otherwise bot-only room
- **WHEN** the host explicitly leaves a room whose only other seats are bots
- **THEN** the room has no host, and it gains a host again only when a human next joins or reconnects

### Requirement: Idle rooms are eventually removed
A room SHALL NOT persist indefinitely once it is no longer useful: a room with no human ever having
connected past a bounded idle period SHALL be removed, and its join code SHALL become invalid for
future joins.

#### Scenario: A room nobody ever joins is eventually gone
- **WHEN** a room is created and no second player joins it for longer than the idle threshold
- **THEN** the room is removed and its join code no longer resolves to any room

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

