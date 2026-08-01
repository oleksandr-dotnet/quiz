## ADDED Requirements

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
