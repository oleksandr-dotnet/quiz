## MODIFIED Requirements

### Requirement: Winning or losing a base-assault question moves a fixed, non-territory score bonus
Every base-assault question that resolves against an enemy's base (not a self-heal) SHALL move a
fixed `GameRules.BaseAssaultScoreBonus` (200 by default) between the attacker and the defender: the
winner of that single question gains it, the loser loses it. This applies independently of whether
the base's hit points reach zero on that question, and independently of any territory the attacker
gains if the base does fall. It applies to every question in a chain, not only the one that ends the
chain. Self-heals are unaffected. Ordinary duels over non-base territory move a related but distinct,
defender-only bonus - see the duel-defense score bonus requirement. The bonus is not tied to any
region and counts toward `GameState.ScoreOf` alongside territory value.

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

#### Scenario: Self-heal is unaffected
- **WHEN** a player targets their own damaged base and the resulting question resolves, successfully
  or not
- **THEN** no score bonus is applied to anyone - only that player's own base hit points change

#### Scenario: The bonus participates in round-limit scoring
- **WHEN** the game ends by round limit rather than elimination
- **THEN** every player's accumulated base-assault score bonus (positive or negative) is included in
  the `ScoreOf` value used to determine the winner, exactly as territory value already is

## ADDED Requirements

### Requirement: Successfully defending a territory in a duel moves a fixed, defender-only score bonus
Every duel over a non-base region that resolves with the defender winning - including a tie, which
the defender-favored tie-break already resolves as a defender win - SHALL add a fixed
`GameRules.BaseAssaultScoreBonus` (200 by default) to the defender's score. Unlike the base-assault
score bonus, this is one-sided: the attacker's score SHALL NOT be reduced when a duel attack fails.
When the attacker wins a duel, no bonus is paid to either combatant - the attacker's gain is limited
to the captured region's territory value, exactly as today. This bonus is not tied to any region and
counts toward `GameState.ScoreOf` alongside territory value, exactly as the base-assault score bonus
already does.

#### Scenario: The defender wins a duel and gains the bonus
- **WHEN** a duel question resolves with the defender ranked ahead of the attacker
- **THEN** the defender's score gains `GameRules.BaseAssaultScoreBonus`, the attacker's score is
  unchanged, and the contested region's ownership is unchanged

#### Scenario: A tie favors the defender and pays the bonus
- **WHEN** a duel question resolves with the attacker and defender tied (including neither
  answering), so the defender-favored tie-break keeps the region with the defender
- **THEN** the defender's score gains `GameRules.BaseAssaultScoreBonus`

#### Scenario: The attacker wins a duel and no bonus is paid
- **WHEN** a duel question resolves with the attacker ranked ahead of the defender and the contested
  region's ownership transfers to the attacker
- **THEN** neither combatant's score changes by `GameRules.BaseAssaultScoreBonus` - the attacker's
  score reflects only the captured region's territory value

#### Scenario: A failed attack never reduces the attacker's score
- **WHEN** a duel question resolves in the defender's favor, for any reason (better rank or a tie)
- **THEN** the attacker's score is not reduced by `GameRules.BaseAssaultScoreBonus` or any other
  amount as a result of that duel

#### Scenario: The bonus participates in round-limit scoring
- **WHEN** the game ends by round limit rather than elimination
- **THEN** every player's accumulated duel-defense score bonus is included in the `ScoreOf` value used
  to determine the winner, exactly as territory value already is
