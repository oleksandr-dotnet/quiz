## MODIFIED Requirements

### Requirement: After every Execute, the game is Finished or has a deadline
`GameEngine` SHALL guarantee that after any `Execute` call returns, once the game has left the
`Lobby` phase, `GameState` is either in the `Finished` phase or has a non-null pending activity
carrying a deadline. This invariant is asserted in `DEBUG` builds. It does not apply while
`Phase == Lobby`: `JoinGame`/`LeaveGame`/a rejected `StartGame` have no activity for anyone to be
waiting on, since the game has not started yet. There is no longer any documented exception once the
game has started: `LandGrab` completing (every region on the map has an owner) now transitions
directly into `Battle`'s first turn instead of leaving `Pending == null`, so the invariant holds
unconditionally for every phase past `Lobby`.

#### Scenario: A resolved question always leads to a new pending activity or Finished
- **WHEN** the last outstanding answer to a question is submitted and the engine pumps forward
- **THEN** the resulting `GameState` has either `Phase == Finished` or a non-null pending activity
  with a deadline

#### Scenario: Base selection completing always produces a next pending activity
- **WHEN** the last player selects their base
- **THEN** `Execute` returns accepted with a `BaseSelectionCompleted` event followed by land grab's
  first `QuestionAsked` event, `Phase` becomes `LandGrab`, and `Pending` is a non-null `Question`
  activity with a deadline

#### Scenario: Land grab completing always produces Battle's first turn
- **WHEN** the last free region on the map is awarded
- **THEN** `Execute` returns accepted with a `LandGrabCompleted` event followed by Battle's first
  turn's events (either an `AttackTargetRequested` for the first player in seat order, or a
  `TurnSkipped` if they have no legal target), `Phase` becomes `Battle`, and `Pending` is non-null

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
  player has selected - the phase transitions into `LandGrab` and its first question is asked, and
  that player's base hit points are initialized to `GameRules.BaseHitPointsDefault`

## ADDED Requirements

### Requirement: Battle phase legal commands
In the `Battle` phase, `GameEngine` SHALL accept only `SelectAttackTarget` while `TargetSelection` is
pending (from the player named on it) and only `SubmitAnswer` while a `Question` is pending (from an
attacker or defender who has not yet answered that question), plus `TimeoutElapsed` at any time,
rejecting every other command with `WrongPhase` or the appropriate pending-activity rejection. A
`RevealHold` pending activity accepts only `TimeoutElapsed`.

#### Scenario: SelectAttackTarget while a question is pending is rejected
- **WHEN** `SelectAttackTarget` is submitted while the current pending activity is `Question`, not
  `TargetSelection`
- **THEN** the command is rejected with `NotAwaitingThisInput`

#### Scenario: SubmitAnswer while a reveal is pending is rejected
- **WHEN** `SubmitAnswer` is submitted while the current pending activity is `RevealHold`
- **THEN** the command is rejected with `NotAwaitingThisInput`

#### Scenario: A command from a player not part of the current duel or assault is rejected
- **WHEN** `SubmitAnswer` is submitted by a known player who is neither the attacker nor the defender
  of the current Battle question
- **THEN** the command is rejected with `NotYourTurn`
