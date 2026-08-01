## ADDED Requirements

### Requirement: Land grab starts the instant base selection ends
Once every occupied seat has picked a base, the engine SHALL transition into the `LandGrab` phase and
ask the first land-grab question, with no intervening state where the game is neither finishing base
selection nor beginning land grab.

#### Scenario: The last base pick starts land grab
- **WHEN** the last occupied seat selects its base
- **THEN** `Phase` becomes `LandGrab` and a `Question` pending activity is created for all active
  players, with a `QuestionAsked` event carrying only a `QuestionPrompt` (no answer field)

### Requirement: All active players answer the same question simultaneously
While a land-grab question is pending, `GameEngine` SHALL accept `SubmitAnswer` once per active
participant, and SHALL reject a second submission from the same player and any submission from a
non-participant or after the question's deadline has passed via `TimeoutElapsed`.

#### Scenario: A player answers once
- **WHEN** an active participant submits an answer to the current land-grab question for the first time
- **THEN** the command is accepted, the player's answer is recorded, and an `AnswerAcknowledged` event
  is emitted carrying only that player's id, never the submitted value

#### Scenario: A second submission from the same player is rejected
- **WHEN** a player who has already answered the current question submits another answer
- **THEN** the command is rejected with `AlreadyAnswered` and their original submission is unchanged

#### Scenario: The question resolves once every participant has answered or timed out
- **WHEN** the last outstanding participant answers, or the question's deadline elapses via
  `TimeoutElapsed`
- **THEN** the engine ranks every participant's answer (or absence of one) using the existing
  answer-ranking kernel and a `QuestionResolved` event is emitted carrying the full question and the
  strict ranking

### Requirement: Ranking determines the award queue
Once a land-grab question resolves, the resulting ranking SHALL determine an award queue: the
1st-ranked participant SHALL be queued 2 region picks, the 2nd-ranked participant SHALL be queued 1
pick, and any remaining ranks SHALL be queued 0 picks. The queue SHALL be interleaved across ranks
(round-robin by remaining pick count) rather than grouped by rank, and SHALL be truncated to the
number of currently free regions.

#### Scenario: A clear 1st and 2nd place each get their picks
- **WHEN** a land-grab question resolves with a strict ranking among 3 or more free regions remaining
- **THEN** the 1st-ranked participant is queued 2 picks and the 2nd-ranked participant is queued 1 pick,
  in the interleaved order `[1st, 2nd, 1st]`

#### Scenario: A thin tail of free regions is distributed fairly
- **WHEN** a land-grab question resolves while fewer free regions remain than the full award queue would
  claim
- **THEN** the award queue is truncated to exactly the number of free regions, preserving the interleaved
  order so 2nd place is not skipped in favor of 1st place taking every remaining region

### Requirement: A region pick must border owned territory when one is available
`GameEngine` SHALL accept `PickRegion` only from the player named at the award queue's current position,
and only for a free region that is adjacent to a region that player already owns - unless no free region
anywhere on the map is adjacent to any region that player owns, in which case any free region is legal.

#### Scenario: A pick bordering owned territory is accepted
- **WHEN** the current picker chooses a free region adjacent to a region they already own
- **THEN** the pick is accepted, that region becomes theirs, and the award queue advances

#### Scenario: A pick not bordering owned territory is rejected when a bordering option exists
- **WHEN** the current picker chooses a free region that does not border any region they own, and at
  least one free region bordering their territory exists
- **THEN** the pick is rejected with `RegionNotEligible` and the award queue position is unchanged

#### Scenario: Any free region is legal once no bordering option exists
- **WHEN** the current picker has no free region bordering any territory they own
- **THEN** a pick of any free region is accepted

#### Scenario: Eligibility is recomputed before each pick in the queue
- **WHEN** one player's pick in an award queue removes the last region that would have bordered the next
  queued player's territory
- **THEN** that next player's eligible-region set, computed fresh at the moment their pick is requested,
  reflects the region's removal

### Requirement: An unresponsive question or region pick resolves on its own
If a participant does not answer a land-grab question before its deadline, they SHALL be scored as
having submitted no answer. If the current award-queue picker does not pick a region before their
deadline, a region SHALL be picked for them automatically using the same eligibility rule a manual pick
would follow.

#### Scenario: A bot or disconnected player is scored as silent
- **WHEN** a participant's land-grab question deadline passes via `TimeoutElapsed` without their having
  submitted an answer
- **THEN** that participant is ranked as if they submitted no answer, with no error and no rejection

#### Scenario: An unresponsive picker's turn resolves automatically
- **WHEN** the current award-queue picker's deadline passes via `TimeoutElapsed` without a `PickRegion`
  command
- **THEN** a region is picked for them automatically, preferring a region bordering their territory when
  one exists, and the award queue advances exactly as a manual pick would

### Requirement: A question with no engagement re-asks, then auto-awards
A land-grab question where every participant's recorded answer is the absence of a submission SHALL be
treated as a dead round: no award queue is started, and a fresh question is asked with the same
participants. After a fixed number of consecutive dead rounds, the engine SHALL instead award territory
using a random ranking rather than asking again.

#### Scenario: A single dead round re-asks without awarding
- **WHEN** a land-grab question resolves and every participant submitted no answer
- **THEN** no region is awarded, no award queue is created, and a new question is asked to the same
  participants with the dead-round count incremented

#### Scenario: Consecutive dead rounds trigger a random auto-award
- **WHEN** the number of consecutive dead rounds for the current set of participants reaches the
  configured threshold
- **THEN** the engine draws a random ranking of the participants via the injected random source and
  starts an award queue from that ranking instead of asking another question

### Requirement: Land grab ends once every region is owned
When an award queue is exhausted and no free region remains anywhere on the map, the engine SHALL emit
`LandGrabCompleted` and leave `Phase == LandGrab` with no pending activity, since the phase that would
supply the next pending activity is out of this capability's scope.

#### Scenario: The last free region is awarded
- **WHEN** the final pick in an award queue claims the last free region on the map
- **THEN** a `LandGrabCompleted` event is emitted, `Phase` remains `LandGrab`, and `Pending` is `null`

#### Scenario: An award queue exhausting with regions still free continues land grab
- **WHEN** an award queue is exhausted (every queued pick has been made or auto-resolved) while at least
  one region remains free
- **THEN** a new land-grab question is asked instead of ending the phase

### Requirement: An in-flight question never reveals another player's answer before resolution
While a land-grab question is pending, every player's view of it SHALL show which participants have
answered, but no participant's submitted value except their own, and no correct answer, until that
question's `QuestionResolved` event has fired.

#### Scenario: Watching another player's in-flight answer
- **WHEN** another participant has answered the current question but it has not yet resolved
- **THEN** the viewer sees that participant as having answered, but not what they answered

#### Scenario: A player sees their own answer echoed
- **WHEN** a player has submitted an answer to the current question and requests their own view
- **THEN** they see their own submitted answer reflected back, so a refresh shows they are "locked in"
