## ADDED Requirements

### Requirement: Only the host can kick another seated player
The room SHALL accept a kick action only from the current host, targeting a different seat. A
non-host's kick attempt SHALL be rejected without changing any seat or game state. A host targeting
their own seat SHALL be rejected the same way.

#### Scenario: A non-host cannot kick
- **WHEN** a seated player who is not the host attempts to kick another player
- **THEN** the action is rejected and no seat or game state changes

#### Scenario: The host cannot kick themselves
- **WHEN** the host targets their own seat with a kick action
- **THEN** the action is rejected and no seat or game state changes

### Requirement: Kicking in the lobby frees the seat
When the host kicks a player before the game has started, that player's seat SHALL become open
immediately, exactly as if that player had voluntarily left the lobby.

#### Scenario: A lobby kick opens the seat
- **WHEN** the host kicks a seated player while the room is still in the lobby
- **THEN** that seat becomes open and available for a new player or a bot, and every other seat is
  unaffected

### Requirement: Kicking mid-game requires the host to choose the kicked player's territory disposition
When the host kicks a player from a game already in progress, the host SHALL choose exactly one of
two dispositions for that player's territory: hand the seat to bot control, or release the player's
owned territory to neutral. The kick SHALL NOT be accepted mid-game without this choice.

#### Scenario: Mid-game kick requires a disposition
- **WHEN** the host kicks a player from a game already in progress
- **THEN** the kick is carried out according to whichever disposition (bot takeover or territory
  release) the host selected

### Requirement: A mid-game kick with bot takeover hands the seat to permanent bot control
Choosing bot takeover SHALL immediately and permanently convert the kicked player's seat to bot
control for the remainder of that game, using the same mechanism and guarantees as a player
voluntarily leaving mid-game.

#### Scenario: The seat keeps playing as a bot
- **WHEN** the host kicks a player mid-game and chooses bot takeover
- **THEN** that seat's remaining base picks, region picks, attack-target selections, and answers are
  submitted by the room on that player's behalf for the rest of the game, exactly as any other bot
  seat's are

### Requirement: A mid-game kick with territory release removes the player from the game and neutralizes their land
Choosing territory release SHALL release every region the kicked player currently owns (including
their base, if any) to unowned/neutral, and SHALL exclude that player from all further turn order,
base-pick order, and land-grab award order for the rest of the game. No other player is credited with
the released territory.

#### Scenario: Released territory becomes unowned
- **WHEN** the host kicks a player mid-game and chooses territory release
- **THEN** every region that player owned immediately becomes unowned, and no other player's
  territory changes as a result

#### Scenario: A released player takes no further turns
- **WHEN** a player has been kicked mid-game with territory release
- **THEN** that player is never asked to pick a base or region, is never included in Battle's turn
  order, and never receives new territory for the remainder of the game

### Requirement: Kicking a player who currently holds the turn does not stall the game
If the kicked player currently holds a pending base pick, region pick, or attack-target selection at
the moment of a territory-release kick, the game SHALL immediately proceed to the next legitimate
actor rather than waiting for that player's turn to time out.

#### Scenario: Kicking the current base-picker advances immediately
- **WHEN** the host kicks (with territory release) the player currently being asked to pick a base
- **THEN** the next player awaiting a base pick is asked immediately, or base selection completes and
  land grab begins if no player remains without a base

#### Scenario: Kicking the current region-picker advances immediately
- **WHEN** the host kicks (with territory release) the player currently at the front of the land-grab
  award queue
- **THEN** the next player in that queue is asked immediately, or land grab proceeds to its next step
  if no one remains in the queue

#### Scenario: Kicking the current attacker advances immediately
- **WHEN** the host kicks (with territory release) the player whose Battle turn is currently active
- **THEN** the next active player's turn begins immediately, following the same order the turn queue
  would otherwise have used

### Requirement: A kicked player sees a localized message and cannot rejoin their old seat
The kicked player's client SHALL receive a notification distinct from a room-closed notification, and
SHALL show a localized message that they were kicked. Neither territory disposition SHALL allow that
player to reclaim their old seat afterward.

#### Scenario: The kicked player sees a distinct message
- **WHEN** a player is kicked, under either territory disposition
- **THEN** their client shows a localized "you were kicked" message, distinct from the message shown
  when a room closes

#### Scenario: A kicked player's old credentials no longer work
- **WHEN** a kicked player's client attempts to rejoin the room using their prior session
- **THEN** the room does not restore them to their old seat under either territory disposition
