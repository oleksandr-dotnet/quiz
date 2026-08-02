# player-leave-and-takeover Specification

## Purpose
Lets a player explicitly leave a game already in progress without stranding their seat: the seat
immediately and permanently becomes bot-controlled for the rest of that game, distinct from a mere
dropped connection, which remains only visibly disconnected per `room-lobby`.

## Requirements

### Requirement: A player can explicitly leave a game already in progress
A seated player SHALL be able to explicitly leave a room whose game has already started (any phase
other than the lobby). Doing so SHALL NOT free the seat, remove the player from the game, or affect
any other seat.

#### Scenario: A player leaves mid-game
- **WHEN** a seated player explicitly leaves a room whose game has started
- **THEN** their seat remains occupied by the same player identity for the rest of the game, and
  every other seat is unaffected

### Requirement: An explicit mid-game leave hands the seat to permanent bot control
When a player explicitly leaves a game already in progress, their seat SHALL immediately become
bot-controlled for the remainder of that game. This handover SHALL NOT be reversible within the same
game - the seat does not return to human control even if the same player rejoins.

#### Scenario: A bot plays the rest of the game for the leaving player
- **WHEN** a seated player explicitly leaves a game already in progress
- **THEN** that seat's remaining base picks, region picks, attack-target selections, and answers are
  all submitted by the room on that player's behalf, exactly as any other bot seat's are

#### Scenario: Rejoining after leaving does not restore human control
- **WHEN** a player who explicitly left a game in progress presents their identifier to the same room
  again before the game ends
- **THEN** their seat remains bot-controlled; it does not revert to awaiting their input

### Requirement: A seat that becomes bot-controlled while it is the current actor is not left waiting on a timeout
The room SHALL schedule a bot move for the current pending activity immediately when a seat becomes
bot-controlled while that activity already names it as the current actor (or an unanswered
participant), rather than only picking up bot behavior on the next activity.

#### Scenario: Leaving during your own pending turn still gets a timely move
- **WHEN** a player explicitly leaves mid-game while a pending activity is currently waiting on their
  own input
- **THEN** a bot move for that same pending activity is scheduled right away, using the same
  human-paced delay any other bot move uses, rather than waiting for the activity's deadline to
  elapse

### Requirement: An explicit mid-game leave is distinct from a dropped connection
A dropped connection alone, without an explicit leave, SHALL continue to only mark the seat as
disconnected (per `room-lobby`'s existing disconnection behavior) and SHALL NOT convert the seat to
bot control - explicitly leaving mid-game and merely losing connection remain two different,
independently triggered behaviors.

#### Scenario: A dropped connection alone does not trigger bot takeover
- **WHEN** a seated human player's connection drops without them explicitly leaving
- **THEN** the seat is shown as disconnected to other players and continues to await that player's
  own input (or the existing timeout fallback), and is not converted to bot control

#### Scenario: Leaving in the lobby is unaffected
- **WHEN** a seated player explicitly leaves a room whose game has not yet started
- **THEN** the existing lobby behavior applies unchanged: the seat becomes open, not bot-controlled
