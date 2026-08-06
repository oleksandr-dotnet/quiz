# battle-flow Specification

## Purpose
Once every region on the map has an owner, players fight over territory: turn-based duels for
ordinary regions, chained assaults against enemy bases (continuing for as long as the attacker keeps
winning) with persistent hit points, elimination on a captured base, and the end-of-game conditions
(last player standing, or highest score at the round limit) that finally produce a winner.
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

### Requirement: A base assault continues until the attacker fails or the base falls, with persistent, global hit points
Attacking an enemy's base region SHALL ask a chain of questions within one turn, with no fixed limit
on how many questions the chain may contain. Each question the attacker wins SHALL immediately and
permanently reduce the defender's base hit points by 1 and SHALL immediately ask another question to
the same attacker and defender, continuing the chain. A base's hit points SHALL never regenerate and
SHALL persist across turns and across different attackers. A tie or a defender win SHALL end the
assault turn immediately, retaining whatever hit points were already lost this turn. The only thing
that ends a winning chain early is the base's hit points reaching zero (a capture, per the following
requirement).

#### Scenario: An assault chains through consecutive wins with no fixed limit
- **WHEN** an attacker wins question after question of a base assault in the same turn
- **THEN** each win permanently reduces the base's hit points by 1 and another question is
  immediately asked to the same attacker and defender, with no limit on how many consecutive
  questions may be asked in one turn other than the base's remaining hit points

#### Scenario: A full-health base can fall in a single turn
- **WHEN** an attacker wins enough consecutive questions in one turn to reduce a base from its
  default maximum hit points all the way to zero
- **THEN** the base is captured within that same turn, with no requirement that a second turn or a
  different attacker finish it off

#### Scenario: An assault chips away at a base without finishing it
- **WHEN** an attacker wins some questions of a base assault but a tie or a defender win ends the
  turn before the base's hit points reach zero
- **THEN** the base's hit points are permanently reduced by the number of questions the attacker won
  before the chain ended, the base remains owned by the defender, and the reduced hit points are
  visible to any future attacker

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
`RevealHold` on its deadline exactly as if it had been acknowledged immediately. A bot player on
turn SHALL NOT rely on the automatic-selection fallback in the normal case: per `bot-gameplay`, a
bot actively submits its own `SelectAttackTarget` choice before the deadline. This fallback remains
the resolution path for a disconnected or unresponsive human, and remains a bot's own safety net if
its scheduled submission is somehow not accepted in time. `RevealHold` is unaffected by bot
behavior: no player, bot or human, ever acts on a reveal, so it always resolves by timeout for
everyone.

#### Scenario: A disconnected attacker's turn resolves automatically
- **WHEN** the player on turn is a disconnected or otherwise unresponsive human and does not submit
  `SelectAttackTarget` before the deadline
- **THEN** one of that player's legal attack targets is selected automatically and a question is
  asked, exactly as a manual selection would produce

#### Scenario: A bot attacker's turn resolves via its own selection
- **WHEN** the player on turn is a bot seat
- **THEN** the bot submits its own `SelectAttackTarget` choice before the deadline in the normal
  case and a question is asked, exactly as a manual selection would produce; a legal target is
  still selected for it automatically if, for any reason, it has not acted once the deadline passes

#### Scenario: A reveal always advances even with no viewer acknowledgment
- **WHEN** a `RevealHold`'s deadline passes via `TimeoutElapsed`
- **THEN** the pump advances to whatever comes next (the next assault question, the next turn, or
  end conditions) with no player input required, regardless of whether any participant is a bot

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
  the defender, which question of the ongoing chain is being asked, and how much damage has been
  dealt to the base so far this turn

#### Scenario: The battle context is absent outside of Battle questions
- **WHEN** the pending activity is not a duel or base-assault question or reveal (for example, a
  land-grab question, or no pending activity at all)
- **THEN** `GameView` carries no battle context

#### Scenario: Battle context never exposes an in-flight or correct answer
- **WHEN** a duel or assault question is pending and one combatant has already answered
- **THEN** the projected battle context contains no submitted value and no correct answer, exactly as
  the existing in-flight-secrecy requirement already guarantees for the question itself

### Requirement: A player's own damaged base is a legal, opt-in attack target
`EligibleAttackTargetsFor` SHALL include a player's own base region as an attack target exactly when
base assaults are unlocked for the current round and that player's base hit points are below the
default maximum. It SHALL NOT be offered when the player's base is already at full hit points, or
before base assaults unlock for the round, exactly matching the timing already governing assaults on
an enemy base.

#### Scenario: A damaged base can target itself once assaults unlock
- **WHEN** it is a player's turn to select an attack target, base assaults are unlocked for the
  current round, and that player's own base hit points are below the default maximum
- **THEN** that player's own base region is included among their eligible attack targets

#### Scenario: A full-health base cannot target itself
- **WHEN** a player's own base hit points are already at the default maximum
- **THEN** that player's own base region is not included among their eligible attack targets,
  regardless of whether base assaults are unlocked

#### Scenario: Self-targeting is unavailable before base assaults unlock
- **WHEN** base assaults are not yet unlocked for the current round
- **THEN** a player's own base region is not included among their eligible attack targets, even if it
  is damaged

### Requirement: Targeting your own base starts a self-heal that continues while you keep succeeding
Selecting your own base as an attack target SHALL ask a question to that player alone. Answering it
exactly correctly SHALL increase that player's base hit points by 1, never exceeding the default
maximum, and SHALL immediately offer that same player another target selection in the same turn -
another self-heal question if their base remains damaged, or an eligible attack on an enemy region
otherwise. Answering incorrectly, answering inexactly (a numeric answer that is not the exact correct
value), or not answering SHALL leave hit points unchanged and SHALL end the turn, passing to the next
active player exactly as any other lost battle turn does.

#### Scenario: A correct answer heals the base by 1 and keeps the turn
- **WHEN** a player targets their own damaged base and answers the resulting question exactly
  correctly
- **THEN** their base hit points increase by 1 and they are immediately offered another target
  selection in the same turn, without the turn passing to another player

#### Scenario: Healing to full then attacking in the same turn
- **WHEN** a player heals their base to the default maximum hit points by answering every self-heal
  question correctly, and an eligible enemy attack target exists
- **THEN** they are offered that attack-target selection (their own base no longer being offered,
  since it is now at full hit points) still within the same turn, without the turn passing to another
  player

#### Scenario: An incorrect or inexact answer ends the turn
- **WHEN** a player targets their own damaged base and answers the resulting question incorrectly,
  gives a numeric answer that is not the exact correct value, or does not answer before the deadline
- **THEN** their base hit points are unchanged and the turn passes to the next active player

#### Scenario: Healing never exceeds the default maximum
- **WHEN** a player's base hit points are already one below the default maximum and they heal
  successfully
- **THEN** their base hit points equal the default maximum, and no further healing is possible until
  the base is damaged again

### Requirement: Base assaults unlock starting at a fixed round, independent of the round limit
`EligibleAttackTargetsFor` SHALL NOT offer any base region - an enemy's base to assault, or the
attacker's own base to self-heal - as an attack target before `GameRules.BaseAssaultUnlockRound`
(round 8 by default). Once the current round reaches that threshold, base regions SHALL become
eligible targets for the remainder of the game. This threshold SHALL be a fixed round number,
independent of `GameRules.RoundLimit` or which ruleset is active - not a fraction or window of the
round limit.

#### Scenario: Base assaults are locked before the unlock round
- **WHEN** the current round is earlier than `GameRules.BaseAssaultUnlockRound`
- **THEN** no base region - neither an enemy's base nor the attacker's own - appears among a
  player's eligible attack targets, even if adjacent or damaged

#### Scenario: Base assaults unlock exactly at the threshold round
- **WHEN** the current round reaches `GameRules.BaseAssaultUnlockRound` (round 8 by default)
- **THEN** base regions become eligible attack targets from that round onward, for every remaining
  round of the game

#### Scenario: The unlock round is independent of the round limit
- **WHEN** a ruleset with a different `RoundLimit` (for example, a longer "Marathon" ruleset) is
  active
- **THEN** base assaults still unlock at the same fixed `GameRules.BaseAssaultUnlockRound`, not at a
  round derived from that ruleset's `RoundLimit`

### Requirement: Winning or losing a base-assault question moves a fixed, non-territory score bonus
Every base-assault question that resolves against an enemy's base (not a self-heal) SHALL move a
fixed `GameRules.BaseAssaultScoreBonus` (200 by default) between the attacker and the defender: the
winner of that single question gains it, the loser loses it. This applies independently of whether
the base's hit points reach zero on that question, and independently of any territory the attacker
gains if the base does fall. It applies to every question in a chain, not only the one that ends the
chain. Ordinary duels over non-base territory and self-heals are unaffected. The bonus is not tied to
any region and counts toward `GameState.ScoreOf` alongside territory value.

#### Scenario: The attacker wins a single hit in an ongoing chain
- **WHEN** an attacker wins a base-assault question and the defender's base hit points remain above
  zero afterward
- **THEN** the attacker's score gains `GameRules.BaseAssaultScoreBonus` and the defender's score loses
  the same amount, in addition to the base's hit points dropping by 1

#### Scenario: The attacker's winning question captures the base
- **WHEN** an attacker wins a base-assault question that reduces the defender's base hit points to
  zero
- **THEN** the attacker's score gains `GameRules.BaseAssaultScoreBonus` and the defender's score loses
  it, in addition to (not instead of) the territory the attacker gains from the capture

#### Scenario: The defender wins or ties, ending the assault
- **WHEN** the defender wins a base-assault question, or the question ties (including a double
  timeout, which the defender-favored tie-break resolves as a defender win)
- **THEN** the defender's score gains `GameRules.BaseAssaultScoreBonus` and the attacker's score loses
  it, and the assault ends for that turn exactly as it already does

#### Scenario: Ordinary duels are unaffected
- **WHEN** a duel over a non-base region resolves, in either direction
- **THEN** neither combatant's score changes by `GameRules.BaseAssaultScoreBonus` - only territory
  ownership changes, exactly as today

#### Scenario: Self-heal is unaffected
- **WHEN** a player targets their own damaged base and the resulting question resolves, successfully
  or not
- **THEN** no score bonus is applied to anyone - only that player's own base hit points change

#### Scenario: The bonus participates in round-limit scoring
- **WHEN** the game ends by round limit rather than elimination
- **THEN** every player's accumulated base-assault score bonus (positive or negative) is included in
  the `ScoreOf` value used to determine the winner, exactly as territory value already is

### Requirement: A tied-correct Choice duel or assault asks a numeric tiebreak question before either territory or hit points change
When a Choice-kind duel or base-assault question resolves with both combatants answering correctly
(see `answer-ranking`'s numeric-tiebreak requirement), the engine SHALL ask exactly one follow-up
numeric question to the same attacker and defender - with its own `RevealHold` reveal, exactly like
any other battle question - before applying the region capture, hit-point change, or turn advance that
question would otherwise have decided. `GameView`'s battle context SHALL identify this follow-up
question as a tiebreak round while it (or its reveal) is pending, using the same attacker, defender,
and contested region as the question that triggered it.

#### Scenario: The tiebreak question is asked to the same two combatants
- **WHEN** a Choice-kind duel or base-assault question resolves with both combatants correct
- **THEN** a new numeric question is asked with the same attacker and defender as participants, and no
  other player

#### Scenario: Territory and hit points are unchanged until the tiebreak resolves
- **WHEN** a numeric tiebreak question is pending, or its own reveal is pending
- **THEN** the contested region's ownership and the defender's base hit points remain exactly as they
  were before the original tied question was asked

#### Scenario: The tiebreak's outcome applies the original question's effect
- **WHEN** the numeric tiebreak question's own reveal closes
- **THEN** the region capture (for a duel) or the hit-point loss/chain-continuation/capture/turn-end
  (for a base assault) that the original question would have applied is applied now, using the
  tiebreak's winner as the decider

#### Scenario: The battle context marks a tiebreak round
- **WHEN** a numeric tiebreak question or its reveal is pending
- **THEN** every viewer's `GameView` battle context identifies it as a tiebreak round, alongside the
  same attacker, defender, contested region, and (for a base assault) chain-progress fields already
  projected for the question that triggered it

