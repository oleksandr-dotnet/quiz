## MODIFIED Requirements

### Requirement: A duel is decided by one question, defender favored on a tie
Attacking a non-base enemy region SHALL ask exactly one question to the attacker and defender. The
better-ranked answer SHALL take the region for its owner; a tie between the two (including both
failing to answer) SHALL be won by the defender, using a tie-break order that places the defender
ahead of the attacker. The question asked SHALL NOT be drawn from a category banned by
`category-ban-draft` for this game.

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

#### Scenario: A duel question never comes from a banned category
- **WHEN** a duel question is asked for a game with at least one banned category
- **THEN** the question drawn is never from a banned category

### Requirement: A base assault continues until the attacker fails or the base falls, with persistent, global hit points
Attacking an enemy's base region SHALL ask a chain of questions within one turn, with no fixed limit
on how many questions the chain may contain. Each question the attacker wins SHALL immediately and
permanently reduce the defender's base hit points by 1 - or by 2 if that question was golden, per
`golden-question`, still never below 0 - and SHALL immediately ask another question to the same
attacker and defender, continuing the chain. A base's hit points SHALL never regenerate and SHALL
persist across turns and across different attackers. A tie or a defender win SHALL end the assault
turn immediately, retaining whatever hit points were already lost this turn. The only thing that ends
a winning chain early is the base's hit points reaching zero (a capture, per the following
requirement).

#### Scenario: An assault chains through consecutive wins with no fixed limit
- **WHEN** an attacker wins question after question of a base assault in the same turn
- **THEN** each win permanently reduces the base's hit points by 1 (or 2 if golden) and another
  question is immediately asked to the same attacker and defender, with no limit on how many
  consecutive questions may be asked in one turn other than the base's remaining hit points

#### Scenario: A full-health base can fall in a single turn
- **WHEN** an attacker wins enough consecutive questions in one turn to reduce a base from its
  default maximum hit points all the way to zero
- **THEN** the base is captured within that same turn, with no requirement that a second turn or a
  different attacker finish it off

#### Scenario: An assault chips away at a base without finishing it
- **WHEN** an attacker wins some questions of a base assault but a tie or a defender win ends the
  turn before the base's hit points reach zero
- **THEN** the base's hit points are permanently reduced by the number of questions the attacker won
  before the chain ended (accounting for any golden doubling), the base remains owned by the
  defender, and the reduced hit points are visible to any future attacker

#### Scenario: A defender win ends the assault immediately
- **WHEN** the defender wins any question during a base assault turn
- **THEN** the assault ends immediately, no further questions are asked this turn, and any hit points
  already lost earlier in the same turn remain lost

#### Scenario: A previously weakened base falls to a second attacker
- **WHEN** a base already reduced to 1 hit point (by an earlier turn, possibly by a different
  attacker) is assaulted again and the attacker wins the single question asked
- **THEN** the base's hit points reach zero and the base is captured

### Requirement: Winning or losing a base-assault question moves a fixed, non-territory score bonus
Every base-assault question that resolves against an enemy's base (not a self-heal) SHALL move a
fixed `GameRules.BaseAssaultScoreBonus` (200 by default) between the attacker and the defender - or
double that amount if the question was golden, per `golden-question`: the winner of that single
question gains it, the loser loses it. This applies independently of whether the base's hit points
reach zero on that question, and independently of any territory the attacker gains if the base does
fall. It applies to every question in a chain, not only the one that ends the chain. Ordinary duels
over non-base territory and self-heals are unaffected by this bonus (see `golden-question` for the
separate golden effect on ordinary duels and self-heals). The bonus is not tied to any region and
counts toward `GameState.ScoreOf` alongside territory value.

#### Scenario: The attacker wins a single hit in an ongoing chain
- **WHEN** an attacker wins a base-assault question and the defender's base hit points remain above
  zero afterward
- **THEN** the attacker's score gains `GameRules.BaseAssaultScoreBonus` (or double, if golden) and
  the defender's score loses the same amount, in addition to the base's hit points dropping
  accordingly

#### Scenario: The attacker's winning question captures the base
- **WHEN** an attacker wins a base-assault question that reduces the defender's base hit points to
  zero
- **THEN** the attacker's score gains `GameRules.BaseAssaultScoreBonus` (or double, if golden) and
  the defender's score loses it, in addition to (not instead of) the territory the attacker gains
  from the capture

#### Scenario: The defender wins or ties, ending the assault
- **WHEN** the defender wins a base-assault question, or the question ties (including a double
  timeout, which the defender-favored tie-break resolves as a defender win)
- **THEN** the defender's score gains `GameRules.BaseAssaultScoreBonus` (or double, if golden) and
  the attacker's score loses it, and the assault ends for that turn exactly as it already does

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

### Requirement: Targeting your own base starts a self-heal that continues while you keep succeeding
Selecting your own base as an attack target SHALL ask a question to that player alone. Answering it
exactly correctly SHALL increase that player's base hit points by 1 - or by 2 if that question was
golden, per `golden-question` - never exceeding the default maximum, and SHALL immediately offer that
same player another target selection in the same turn - another self-heal question if their base
remains damaged, or an eligible attack on an enemy region otherwise. Answering incorrectly, answering
inexactly (a numeric answer that is not the exact correct value), or not answering SHALL leave hit
points unchanged and SHALL end the turn, passing to the next active player exactly as any other lost
battle turn does.

#### Scenario: A correct answer heals the base by 1 and keeps the turn
- **WHEN** a player targets their own damaged base and answers the resulting question exactly
  correctly
- **THEN** their base hit points increase by 1 (or 2 if golden) and they are immediately offered
  another target selection in the same turn, without the turn passing to another player

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
  successfully (including a golden heal that would otherwise restore 2)
- **THEN** their base hit points equal the default maximum, and no further healing is possible until
  the base is damaged again
