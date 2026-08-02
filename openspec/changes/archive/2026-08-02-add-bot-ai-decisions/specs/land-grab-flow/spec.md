## MODIFIED Requirements

### Requirement: An unresponsive question or region pick resolves on its own
If a participant does not answer a land-grab question before its deadline, they SHALL be scored as
having submitted no answer. If the current award-queue picker does not pick a region before their
deadline, a region SHALL be picked for them automatically using the same eligibility rule a manual
pick would follow. A bot participant SHALL NOT rely on either fallback in the normal case: per
`bot-gameplay`, a bot actively submits its own answer and, when it is the award-queue picker, its
own region pick, before the respective deadline. These fallbacks remain the resolution path for a
disconnected or unresponsive human, and remain a bot's own safety net if its scheduled submission
is somehow not accepted in time.

#### Scenario: A disconnected player is scored as silent
- **WHEN** a disconnected or otherwise unresponsive human participant's land-grab question deadline
  passes via `TimeoutElapsed` without their having submitted an answer
- **THEN** that participant is ranked as if they submitted no answer, with no error and no rejection

#### Scenario: A bot answers a land-grab question
- **WHEN** a bot seat is an active participant in a pending land-grab question
- **THEN** the bot submits its own answer before the question's deadline in the normal case; it is
  still scored as silent if, for any reason, it has not answered once the deadline passes

#### Scenario: An unresponsive human picker's turn resolves automatically
- **WHEN** the current award-queue picker is a disconnected or otherwise unresponsive human and
  their deadline passes via `TimeoutElapsed` without a `PickRegion` command
- **THEN** a region is picked for them automatically, preferring a region bordering their territory
  when one exists, and the award queue advances exactly as a manual pick would

#### Scenario: A bot picker's turn resolves via its own pick
- **WHEN** the current award-queue picker is a bot seat
- **THEN** the bot submits its own `PickRegion` choice before the deadline in the normal case, and
  the award queue advances exactly as a manual pick would; a region is still picked for it
  automatically if, for any reason, it has not acted once the deadline passes
