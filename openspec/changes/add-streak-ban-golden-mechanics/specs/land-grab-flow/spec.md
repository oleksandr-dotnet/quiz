## MODIFIED Requirements

### Requirement: Ranking determines the award queue
Once a land-grab question resolves, the resulting ranking SHALL determine an award queue: the
1st-ranked participant SHALL be queued 2 region picks, the 2nd-ranked participant SHALL be queued 1
pick, and any remaining ranks SHALL be queued 0 picks - except when the resolved question is golden
(per `golden-question`), in which case those counts are doubled. The queue SHALL be interleaved
across ranks (round-robin by remaining pick count) rather than grouped by rank, and SHALL be
truncated to the number of currently free regions.

#### Scenario: A clear 1st and 2nd place each get their picks
- **WHEN** a land-grab question resolves with a strict ranking among 3 or more free regions remaining
- **THEN** the 1st-ranked participant is queued 2 picks and the 2nd-ranked participant is queued 1 pick,
  in the interleaved order `[1st, 2nd, 1st]`

#### Scenario: A thin tail of free regions is distributed fairly
- **WHEN** a land-grab question resolves while fewer free regions remain than the full award queue would
  claim
- **THEN** the award queue is truncated to exactly the number of free regions, preserving the interleaved
  order so 2nd place is not skipped in favor of 1st place taking every remaining region

#### Scenario: A golden land-grab question doubles the award queue
- **WHEN** a golden land-grab question resolves with a clear 1st and 2nd place
- **THEN** the award queue is built using 4 picks for 1st and 2 picks for 2nd instead of the usual 2
  and 1, per `golden-question`, still subject to the same interleaving and free-region truncation

### Requirement: A question with no engagement re-asks, then auto-awards
A land-grab question where every participant's recorded answer is the absence of a submission SHALL be
treated as a dead round: no award queue is started, and a fresh question is asked with the same
participants. After a fixed number of consecutive dead rounds, the engine SHALL instead award territory
using a random ranking rather than asking again. A category banned by `category-ban-draft` SHALL NOT be
eligible for selection when a fresh or replacement question is chosen, exactly as for any other
land-grab question.

#### Scenario: A single dead round re-asks without awarding
- **WHEN** a land-grab question resolves and every participant submitted no answer
- **THEN** no region is awarded, no award queue is created, and a new question is asked to the same
  participants with the dead-round count incremented

#### Scenario: Consecutive dead rounds trigger a random auto-award
- **WHEN** the number of consecutive dead rounds for the current set of participants reaches the
  configured threshold
- **THEN** the engine draws a random ranking of the participants via the injected random source and
  starts an award queue from that ranking instead of asking another question

#### Scenario: A re-asked question still excludes banned categories
- **WHEN** a dead-round question is re-asked to the same participants
- **THEN** the replacement question is drawn from categories that have not been banned for this game
