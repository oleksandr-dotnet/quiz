# answer-ranking Specification

## Purpose
Ranks every player's answer to one question into a strict order, so land grab, duels, and base
assaults can all resolve who did best from the same deterministic algorithm — including how ties
are broken, without relying on chance at resolution time.

## Requirements

### Requirement: Answers are scored into a tier and a penalty
`AnswerEvaluator.Evaluate` SHALL reduce any submitted answer (or its absence) to an `AnswerScore
(Tier, Penalty)` pair so that choice and numeric questions can be ranked by the same comparator.

#### Scenario: Correct choice answer scores tier 0
- **WHEN** a choice question is evaluated with the correct option selected
- **THEN** the resulting `AnswerScore` has `Tier == 0` and `Penalty == 0`

#### Scenario: Wrong choice answer scores tier 1
- **WHEN** a choice question is evaluated with an incorrect option selected
- **THEN** the resulting `AnswerScore` has `Tier == 1`

#### Scenario: No choice answer scores tier 2
- **WHEN** a choice question is evaluated with no submission (timeout) or an out-of-range option
  index
- **THEN** the resulting `AnswerScore` has `Tier == 2`

#### Scenario: Numeric answer scores by absolute error
- **WHEN** a numeric (tip) question is evaluated with a submitted value
- **THEN** the resulting `AnswerScore` has `Tier == 0` and `Penalty` equal to the absolute
  difference between the submitted value and the correct value

#### Scenario: No numeric answer scores tier 1
- **WHEN** a numeric question is evaluated with no submission
- **THEN** the resulting `AnswerScore` has `Tier == 1`

### Requirement: Answers rank by tier, then penalty, then elapsed time, then tie-break order
`AnswerRanker.Rank` SHALL produce a strict `1..n` ranking of every participant's answer to one
question, ordering ascending by `Tier`, then `Penalty`, then elapsed time since the question was
asked (a missing elapsed time — no submission — sorts last), then by each participant's position in
the supplied `TieBreakOrder`.

#### Scenario: Lower tier always outranks higher tier
- **WHEN** ranking two answers where one has `Tier == 0` and the other `Tier == 1`
- **THEN** the tier-0 answer ranks strictly above the tier-1 answer regardless of penalty or elapsed
  time

#### Scenario: Within the same tier, lower penalty ranks higher
- **WHEN** ranking two numeric answers both at `Tier == 0` with different absolute errors
- **THEN** the answer with the smaller absolute error ranks above the other

#### Scenario: Within the same tier and penalty, faster answer ranks higher
- **WHEN** ranking two answers with equal tier and equal penalty but different elapsed times
- **THEN** the answer submitted with less elapsed time ranks above the other

#### Scenario: A true tie is resolved by the fixed tie-break order
- **WHEN** two or more answers are equal on tier, penalty, and elapsed time
- **THEN** the ranking between them follows the order each participant appears in the supplied
  `TieBreakOrder`, and the overall ranking remains a strict `1..n` order with no shared ranks

#### Scenario: Ranking output is always a strict total order
- **WHEN** `AnswerRanker.Rank` is called with any set of participants and answers, including all
  participants failing to answer
- **THEN** the returned ranking assigns each participant a distinct rank from 1 to the number of
  participants, with no gaps and no ties

### Requirement: Tie-break order is fixed at question-ask time
A `TieBreakOrder` SHALL be a permutation of the question's participants that is decided once, when
the question is asked, and stored as part of the pending state — never recomputed at resolution
time — so that replaying the same command log with the same seed reproduces the same winner.

#### Scenario: Land grab tie-break is a seeded shuffle
- **WHEN** a land-grab question is asked for a set of participants
- **THEN** the `TieBreakOrder` for that question is a shuffle of the participants drawn from the
  injected `IRandomSource`, fixed for the lifetime of that question

#### Scenario: Duel and assault tie-break always favors the defender
- **WHEN** a duel or base-assault question is asked with a designated attacker and defender
- **THEN** the `TieBreakOrder` for that question places the defender ahead of the attacker, so a
  surviving tie between exactly those two participants is always won by the defender

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
