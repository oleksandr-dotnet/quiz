# battle-flow Specification

## Purpose
Once every region on the map has an owner, players fight over territory: turn-based duels for
ordinary regions, up-to-three-question assaults against enemy bases with persistent hit points,
elimination on a captured base, and the end-of-game conditions (last player standing, or highest
score at the round limit) that finally produce a winner.

## Requirements

### Requirement: Battle starts the instant land grab ends
Once every region on the map has an owner, the engine SHALL transition into the `Battle` phase and
begin the first player's turn in seat order, with no intervening state where the game is neither
finishing land grab nor beginning battle.

#### Scenario: The last region awarded starts battle
- **WHEN** the last free region on the map is awarded
- **THEN** `Phase` becomes `Battle` and either a `TargetSelection` pending activity is created for the
  first active player in seat order, or - if that player has no legal attack target - a `TurnSkipped`
  event is emitted and the turn passes to the next active player

### Requirement: Turns proceed in seat order, one round per full cycle
A Battle round SHALL consist of exactly one attack turn for every player who is active (not
eliminated) at the moment the round begins, in seat order. Eliminations during a round SHALL NOT
change whose turn it already is or skip a player who has not yet acted this round; they SHALL only
affect who is included when the next round's turn order is built.

#### Scenario: A player eliminated mid-round does not disrupt the current turn order
- **WHEN** a player is eliminated partway through a round
- **THEN** every other player who had not yet taken their turn this round still takes it, in the same
  seat-order sequence already established for the round

#### Scenario: A new round rebuilds turn order from the players still active
- **WHEN** every player active at the start of a round has taken their turn
- **THEN** a new round begins with turn order rebuilt from exactly the players active at that moment,
  in seat order

### Requirement: A player with no legal attack target skips their turn
`GameEngine` SHALL skip the turn of a player who owns no region adjacent to any region owned by
another active player, asking no question and spending no activity.

#### Scenario: No adjacent enemy territory exists
- **WHEN** it becomes a player's turn and no other active player owns a region adjacent to any region
  that player owns
- **THEN** a `TurnSkipped` event is emitted for that player and the turn passes to the next active
  player without any pending question

### Requirement: An attack target must be an enemy region adjacent to the attacker's territory
`GameEngine` SHALL accept `SelectAttackTarget` only from the player named on the current
`TargetSelection` pending activity, and only for a region owned by another active player that is
adjacent (via `AdjacencyIndex`) to a region the attacker owns.

#### Scenario: A legal target is accepted
- **WHEN** the player on turn selects an enemy-owned region adjacent to one of their own regions
- **THEN** the command is accepted and a question is asked to both the attacker and the defender

#### Scenario: A non-adjacent target is rejected
- **WHEN** the player on turn selects an enemy-owned region that does not border any region they own
- **THEN** the command is rejected with a rule-legality `RejectionCode` and `TargetSelection` remains
  pending for that player

#### Scenario: Selecting a region the attacker already owns is rejected
- **WHEN** the player on turn selects a region they already own
- **THEN** the command is rejected with a rule-legality `RejectionCode`

### Requirement: A duel is decided by one question, defender favored on a tie
Attacking a non-base enemy region SHALL ask exactly one question to the attacker and defender. The
better-ranked answer SHALL take the region for its owner; a tie between the two (including both
failing to answer) SHALL be won by the defender, using a tie-break order that places the defender
ahead of the attacker.

#### Scenario: The attacker answers better and captures the region
- **WHEN** a duel question resolves with the attacker ranked ahead of the defender
- **THEN** the contested region's ownership transfers to the attacker

#### Scenario: The defender answers better and keeps the region
- **WHEN** a duel question resolves with the defender ranked ahead of the attacker
- **THEN** the contested region's ownership is unchanged

#### Scenario: A tie or double-timeout favors the defender
- **WHEN** a duel question resolves with the attacker and defender tied (including neither answering)
- **THEN** the tie-break order places the defender first, and the contested region's ownership is
  unchanged

### Requirement: A base assault runs up to three questions with persistent, global hit points
Attacking an enemy's base region SHALL run up to `min(3, defender's current base hit points)`
questions in one turn. Each question the attacker wins SHALL immediately and permanently reduce the
defender's base hit points by 1; a base's hit points SHALL never regenerate and SHALL persist across
turns and across different attackers. Any question the defender wins SHALL end the assault turn
immediately, retaining whatever hit points were already lost this turn.

#### Scenario: An assault chips away at a base without finishing it
- **WHEN** an attacker wins one question of a base assault but the base's hit points do not reach zero
  within the up-to-3-question limit for that turn
- **THEN** the base's hit points are permanently reduced by the number of questions the attacker won,
  the base remains owned by the defender, and the reduced hit points are visible to any future
  attacker

#### Scenario: A defender win ends the assault immediately
- **WHEN** the defender wins any question during a base assault turn
- **THEN** the assault ends immediately, no further questions are asked this turn, and any hit points
  already lost earlier in the same turn remain lost

#### Scenario: A previously weakened base falls to a second attacker
- **WHEN** a base already reduced to 1 hit point (by an earlier turn, possibly by a different
  attacker) is assaulted again and the attacker wins the single question asked
- **THEN** the base's hit points reach zero and the base is captured

### Requirement: A captured base eliminates its owner and transfers everything they held
When a base's hit points reach zero, the attacker SHALL take the base region and every other region
the defending player owned. The defending player SHALL become eliminated. The captured base SHALL
become an ordinary territory worth its map value - the attacker SHALL NOT gain the 1000-point base
bonus for it.

#### Scenario: Every region transfers to the conqueror
- **WHEN** a base assault reduces the defender's base hit points to zero
- **THEN** the attacker becomes the owner of the base region and every region the defender owned
  immediately before elimination

#### Scenario: The defeated player is eliminated
- **WHEN** a base assault reduces the defender's base hit points to zero
- **THEN** the defending player is marked eliminated and is excluded from all future turn order and
  attack-target eligibility

#### Scenario: A captured base stops being worth 1000
- **WHEN** a player's score is computed after they captured another player's base
- **THEN** that base region contributes its ordinary map value to their score, not the 1000-point
  base bonus, since the bonus only applies to a player's own, unconquered base

### Requirement: A resolved battle question is followed by a reveal before its effects apply
Every duel or base-assault question's resolution SHALL be followed by a `RevealHold` pending
activity carrying the resolved result, with its own deadline. The capture, hit-point reduction, or
elimination that question decided SHALL take effect only once `RevealHold` resolves (via
`TimeoutElapsed`), not at the moment the question itself resolves.

#### Scenario: A reveal is shown before a captured region changes hands
- **WHEN** a duel question resolves in the attacker's favor
- **THEN** every player sees the resolved question's result during a `RevealHold` period before the
  contested region's ownership actually changes

#### Scenario: RevealHold accepts only its own timeout
- **WHEN** any command other than `TimeoutElapsed` targeting the current `RevealHold` is submitted
- **THEN** the command is rejected with `NotAwaitingThisInput`

### Requirement: An unresponsive turn or reveal resolves on its own
`GameEngine` SHALL automatically select a legal attack target for the player on turn if they do not
select one before the deadline (or skip their turn if none exist), and SHALL advance past a
`RevealHold` on its deadline exactly as if it had been acknowledged immediately.

#### Scenario: A bot or disconnected attacker's turn resolves automatically
- **WHEN** the player on turn does not submit `SelectAttackTarget` before the deadline
- **THEN** one of that player's legal attack targets is selected automatically and a question is
  asked, exactly as a manual selection would produce

#### Scenario: A reveal always advances even with no viewer acknowledgment
- **WHEN** a `RevealHold`'s deadline passes via `TimeoutElapsed`
- **THEN** the pump advances to whatever comes next (the next assault question, the next turn, or end
  conditions) with no player input required

### Requirement: The game ends on elimination down to one player or a round limit, whichever comes first
The game SHALL end immediately, before the round limit, the instant only one player remains active -
that player wins even if their score is lower than an eliminated player's frozen score. Otherwise the
game SHALL end once `GameRules.RoundLimit` rounds have completed, with the highest `GameState.ScoreOf`
score winning; every player tied for the highest score SHALL be reported as a winner.

#### Scenario: Last player standing wins regardless of score
- **WHEN** an elimination leaves exactly one active player
- **THEN** the game transitions to `Phase == Finished` immediately, with that player as the sole
  winner in `GameOutcome`, even if another eliminated player's earlier score was higher

#### Scenario: The round limit ends the game on score
- **WHEN** `GameRules.RoundLimit` rounds have completed with more than one player still active
- **THEN** the game transitions to `Phase == Finished`, and every player with the highest `ScoreOf`
  value is listed as a winner in `GameOutcome`

#### Scenario: Equal top scores produce multiple winners
- **WHEN** the game ends by round limit and two or more players share the highest score
- **THEN** `GameOutcome` lists every one of those tied players as a winner

### Requirement: An in-flight duel or assault question never reveals another player's answer before resolution
While a Battle question is pending, both the attacker and defender's view of it SHALL show whether
the other has answered, but never their submitted value or the correct answer, until that question's
`QuestionResolved` event has fired.

#### Scenario: Watching the opponent's in-flight answer
- **WHEN** the defender has answered the current duel or assault question but it has not yet resolved
- **THEN** the attacker sees the defender as having answered, but not what they answered, and vice
  versa

### Requirement: The nature of the current fight is projected to every viewer
While a Battle question or its reveal is pending, `GameView` SHALL carry which region is contested,
whether the fight is a duel or a base assault, who the attacker and defender are, and - for a base
assault - which question of the chain is being asked and how much damage has been dealt this turn.
This projection SHALL describe only facts both combatants already know (identities, the contested
region, assault progress), never an in-flight answer or the correct answer.

#### Scenario: A duel names the contested region and both combatants
- **WHEN** a duel question or its reveal is pending
- **THEN** every viewer's `GameView` identifies the contested region, the attacker, and the defender

#### Scenario: A base assault reports progress within the turn
- **WHEN** a base-assault question or its reveal is pending
- **THEN** every viewer's `GameView` identifies the assault's contested base region, the attacker,
  the defender, which question of the up-to-three-question chain is being asked, and how much damage
  has been dealt to the base so far this turn

#### Scenario: The battle context is absent outside of Battle questions
- **WHEN** the pending activity is not a duel or base-assault question or reveal (for example, a
  land-grab question, or no pending activity at all)
- **THEN** `GameView` carries no battle context

#### Scenario: Battle context never exposes an in-flight or correct answer
- **WHEN** a duel or assault question is pending and one combatant has already answered
- **THEN** the projected battle context contains no submitted value and no correct answer, exactly as
  the existing in-flight-secrecy requirement already guarantees for the question itself
