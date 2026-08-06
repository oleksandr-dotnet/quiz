## ADDED Requirements

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
