## MODIFIED Requirements

### Requirement: After every Execute, the game is Finished or has a deadline
`GameEngine` SHALL guarantee that after any `Execute` call returns, once the game has left the
`Lobby` phase, `GameState` is either in the `Finished` phase or has a non-null pending activity
carrying a deadline. This invariant is asserted in `DEBUG` builds. It does not apply while
`Phase == Lobby`: `JoinGame`/`LeaveGame`/a rejected `StartGame` have no activity for anyone to be
waiting on, since the game has not started yet. The one documented exception once the game has
started is the moment `LandGrab` completes (every region on the map has an owner): the phase that
would supply the next pending activity is out of scope until a future change adds it, so the engine
leaves `Phase == LandGrab` with `Pending == null` at that exact instant, and a `LandGrabCompleted`
event marks it. `BaseSelection` completing no longer produces this exception - it now transitions
directly into `LandGrab`'s first question. A future change implementing the phase after `LandGrab`
closes this gap the same way this change closed the previous one, at which point the invariant
becomes unconditional for every phase past `Lobby`.

#### Scenario: A resolved question always leads to a new pending activity or Finished
- **WHEN** the last outstanding answer to a question is submitted and the engine pumps forward
- **THEN** the resulting `GameState` has either `Phase == Finished` or a non-null pending activity
  with a deadline

#### Scenario: Base selection completing always produces a next pending activity
- **WHEN** the last player selects their base
- **THEN** `Execute` returns accepted with a `BaseSelectionCompleted` event followed by land grab's
  first `QuestionAsked` event, `Phase` becomes `LandGrab`, and `Pending` is a non-null `Question`
  activity with a deadline

#### Scenario: Land grab completing is the one documented exception
- **WHEN** the last free region on the map is awarded and no further phase is implemented to receive
  control
- **THEN** `Execute` returns accepted with a `LandGrabCompleted` event, `Phase` remains `LandGrab`,
  and `Pending` is `null` - the sole state in this scope where the Finished-or-pending invariant does
  not hold, and it is documented here rather than silently violated

### Requirement: Base selection legality
In the `BaseSelection` phase, `GameEngine` SHALL accept `SelectBase` only from the player named in
the current `BasePick` pending activity, for a region that is unowned and at least
`GameRules.MinimumBaseDistance` hops (via `AdjacencyIndex`) from every already-selected base - unless
no region satisfies that distance, in which case the requirement relaxes automatically for that pick.

#### Scenario: A base pick too close to an existing base is rejected
- **WHEN** `SelectBase` is submitted for a region closer than `MinimumBaseDistance` hops to an
  already-selected base, and at least one region satisfying the distance requirement remains free
- **THEN** the command is rejected with a rule-legality `RejectionCode`

#### Scenario: The distance requirement relaxes when no legal region remains
- **WHEN** `SelectBase` is submitted for an unowned region, and no free region anywhere on the map
  satisfies `MinimumBaseDistance` from every already-selected base
- **THEN** the command is accepted despite being closer than `MinimumBaseDistance` to an existing
  base

#### Scenario: Base selection proceeds in seat order
- **WHEN** a player selects a valid base
- **THEN** the pending `BasePick` activity advances to the next player in seat order, or - if every
  player has selected - the phase transitions into `LandGrab` and its first question is asked

## ADDED Requirements

### Requirement: LandGrab phase legal commands
In the `LandGrab` phase, `GameEngine` SHALL accept only `SubmitAnswer` while a `Question` is pending
(from any active participant who has not yet answered that question) and only `PickRegion` while
`RegionPicks` is pending (from the player named at the award queue's current position), plus
`TimeoutElapsed` at any time, rejecting every other command with `WrongPhase` or the appropriate
pending-activity rejection.

#### Scenario: SubmitAnswer while a region pick is pending is rejected
- **WHEN** `SubmitAnswer` is submitted while the current pending activity is `RegionPicks`, not
  `Question`
- **THEN** the command is rejected with `NotAwaitingThisInput`

#### Scenario: PickRegion while a question is pending is rejected
- **WHEN** `PickRegion` is submitted while the current pending activity is `Question`, not
  `RegionPicks`
- **THEN** the command is rejected with `NotAwaitingThisInput`
