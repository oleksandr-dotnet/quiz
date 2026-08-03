## ADDED Requirements

### Requirement: Room and connection lifecycle events are logged
The server SHALL log, at Information level, a SignalR connection's connect and disconnect, a room's
creation and shutdown, a player joining or leaving a room, a player being kicked, and a game
starting. Each log entry SHALL include enough identifying context (room code, and player id where
applicable) to follow a single room's story from server logs alone.

#### Scenario: A connection's lifecycle is visible
- **WHEN** a client connects to or disconnects from the SignalR hub
- **THEN** the server logs an Information-level entry identifying the connection

#### Scenario: Room creation and shutdown are visible
- **WHEN** a room is created, or a room shuts down (idle eviction or explicit shutdown)
- **THEN** the server logs an Information-level entry identifying the room by its room code

#### Scenario: Joining, leaving, and kicking are visible
- **WHEN** a player successfully joins a room, leaves a room, or is kicked from a room
- **THEN** the server logs an Information-level entry identifying the room, the acting player, and
  (for a kick) the target player

#### Scenario: Game start is visible
- **WHEN** a host successfully starts a game
- **THEN** the server logs an Information-level entry identifying the room and the number of players

### Requirement: A rejected command is logged with its reason
The server SHALL log, at Warning level, any command rejected by a room (an invalid seat change, an
out-of-turn action, a stale activity token, or any other rejection reason), including the rejection
reason and the connection or player that submitted it. This applies to every command, including
high-frequency in-game actions (submitting an answer, picking a region, selecting an attack target,
selecting a base) whose successful outcome is not separately logged at Information.

#### Scenario: A rejected lobby or game-start command is logged
- **WHEN** a seat change, room join, leave, kick, or game-start command is rejected
- **THEN** the server logs a Warning-level entry with the rejection reason

#### Scenario: A rejected in-game action is logged even though its success is not
- **WHEN** a player's answer submission, region pick, attack-target selection, or base selection is
  rejected by the room
- **THEN** the server logs a Warning-level entry with the rejection reason, even though a *successful*
  submission of the same action type produces no Information-level log entry

### Requirement: Notable in-game outcomes are logged
The server SHALL log, at Information level, a player's elimination, a base's capture, and a game's
completion (including its winner or winners), each identified by room code and the relevant player,
region, or winner ids. Other in-game domain events that occur many times per game (a region captured
in an ordinary duel, a round advancing, a question being asked or resolved) SHALL NOT be logged at
Information, to keep routine per-question activity from dominating the log output.

#### Scenario: A player elimination is logged
- **WHEN** a base assault reduces a defender's base hit points to zero and that player is eliminated
- **THEN** the server logs an Information-level entry identifying the room and the eliminated player

#### Scenario: A base capture is logged
- **WHEN** a base assault captures the defender's base region
- **THEN** the server logs an Information-level entry identifying the room, the attacker, the
  defender, and the captured base region

#### Scenario: Game completion is logged with the winner(s)
- **WHEN** the game ends (elimination down to one player, or the round limit is reached)
- **THEN** the server logs an Information-level entry identifying the room and every winning player

#### Scenario: Routine per-question events are not logged at Information
- **WHEN** an ordinary duel captures a non-base region, a round advances, or a question is asked or
  resolved
- **THEN** no Information-level log entry is produced for that event by this requirement (a separate,
  lower-frequency requirement may still cover a rejected command or a notable outcome arising from the
  same turn)
