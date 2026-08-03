## MODIFIED Requirements

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

## ADDED Requirements

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
