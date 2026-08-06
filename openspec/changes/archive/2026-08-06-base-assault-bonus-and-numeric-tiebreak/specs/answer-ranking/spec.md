## ADDED Requirements

### Requirement: A tied-correct Choice-question duel or base assault is broken by a numeric tiebreak, not elapsed time
For a duel or base-assault question of Choice kind with exactly two participants (attacker and
defender), if both participants' answers score `Tier 0` (both correct), elapsed time SHALL NOT decide
the outcome. Instead, the engine SHALL ask exactly one follow-up question - always numeric (Tip kind)
- to the same two participants, and SHALL rank it with the same tier/penalty/elapsed/tie-break order
used everywhere else; the closer numeric answer wins. Only when that follow-up question is itself a
full tie (equal tier, equal penalty - including both being exactly correct) does elapsed time, and
then the fixed tie-break order, decide as usual.

#### Scenario: Both combatants answer a Choice question correctly
- **WHEN** a duel or base-assault question of Choice kind resolves with both the attacker and the
  defender scoring `Tier 0`
- **THEN** elapsed time is not consulted, and exactly one follow-up numeric question is asked to the
  same two participants before the duel or assault question that triggered it is considered decided

#### Scenario: The numeric tiebreak decides by closeness
- **WHEN** the follow-up numeric question resolves with the attacker and defender at different
  absolute distances from the correct value
- **THEN** whichever combatant is numerically closer wins the duel or assault question that triggered
  the tiebreak, regardless of which of them answered faster

#### Scenario: An equally-close numeric tiebreak falls back to elapsed time
- **WHEN** the follow-up numeric question resolves with the attacker and defender at the same
  absolute distance from the correct value, including both being exactly correct
- **THEN** the combatant who answered the numeric tiebreak question faster wins; a further tie
  (identical elapsed time, or neither answering) is resolved by the same defender-favored tie-break
  order used for every other duel or base-assault question

#### Scenario: Tiers that already differ are unaffected
- **WHEN** a Choice-kind duel or base-assault question resolves with the attacker and defender at
  different tiers (one correct, one wrong or silent)
- **THEN** the higher tier wins immediately, exactly as today, with no numeric tiebreak question asked

#### Scenario: A Tip question asked directly is unaffected
- **WHEN** the first question of a duel or base-assault is itself a numeric (Tip) question rather than
  Choice
- **THEN** it is ranked by the existing tier/penalty/elapsed/tie-break order with no separate tiebreak
  question, exactly as it already is today

#### Scenario: Land grab is unaffected
- **WHEN** a land-grab question (more than two participants, seeded-shuffle tie-break) resolves with
  two or more participants tied on tier and penalty
- **THEN** the existing elapsed-time-then-seeded-shuffle tie-break decides, with no numeric tiebreak
  question, since this requirement applies only to the two-participant duel/base-assault shape
