# game-setup-rules Specification

## Purpose
Governs the `Lobby` and `BaseSelection` phases of a game: who may join or start, how bases are
picked in seat order under an adjacency-distance rule, and the command/rejection contract
(validation order, stale-timeout handling, the Finished-or-pending invariant) that every phase of
the engine follows.

## Requirements

### Requirement: Commands are validated fully before any mutation
`GameEngine.Execute(command)` SHALL either accept a command and apply every one of its effects, or
reject it and leave `GameState` completely unchanged. There is no partial application.

#### Scenario: A rejected command leaves state unchanged
- **WHEN** any command is submitted that fails validation for any `RejectionCode`
- **THEN** the `GameState` before and after `Execute` is called is identical (same fingerprint), and
  `Execute` returns a `CommandResult` with `IsAccepted == false` and the corresponding
  `RejectionCode`

#### Scenario: Rejections are values, not exceptions
- **WHEN** a command is illegal for any player-reachable or race-reachable reason (wrong phase,
  unknown player, stale token, not your turn, already answered, invalid payload, illegal move)
- **THEN** `Execute` returns a rejected `CommandResult` and does not throw
- **THEN** `Execute` only throws when an invariant internal to the engine itself is violated (a bug,
  not a player action)

### Requirement: Rejection precedence is fixed
When a command could be rejected for more than one reason, `GameEngine` SHALL apply the checks in a
fixed order so the caller always sees the most informative rejection: `GameAlreadyFinished` →
`WrongPhase` → `UnknownPlayer`/eliminated → `NotAwaitingThisInput` → `StaleActivityToken` →
`NotYourTurn` → `AlreadyAnswered` → payload validity → rule legality.

#### Scenario: A finished game rejects everything as GameAlreadyFinished
- **WHEN** any command is submitted after the game has reached `Finished`
- **THEN** the command is rejected with `GameAlreadyFinished`, even if it would also be invalid for
  another reason

#### Scenario: A stale token is reported before turn-order checks
- **WHEN** a command carries an `ActivityToken` that does not match the current pending activity, and
  is also not submitted by the player whose turn it is
- **THEN** the command is rejected with `StaleActivityToken`, not `NotYourTurn`

### Requirement: A stale TimeoutElapsed is a harmless no-op
`TimeoutElapsed(token, now)` carrying a token that does not match the current pending activity SHALL
be accepted (`IsAccepted == true`) and produce zero events — never a rejection and never an
exception. A `TimeoutElapsed` submitted before the pending activity's deadline SHALL be rejected with
`DeadlineNotReached`.

#### Scenario: A late or duplicate timeout fire is silently accepted
- **WHEN** `TimeoutElapsed` is submitted with a token from an activity that has already resolved
- **THEN** `Execute` returns `IsAccepted == true` with an empty event list, and `GameState` is
  unchanged

#### Scenario: An early timeout is rejected
- **WHEN** `TimeoutElapsed` is submitted with `now` earlier than the current pending activity's
  deadline
- **THEN** the command is rejected with `DeadlineNotReached`

### Requirement: Every command carries the time it happened
Every command that can affect timing-sensitive state SHALL carry an `Instant At` supplied by the
caller. The engine SHALL never read an ambient clock; elapsed time for an answer is computed as
`command.At.Since(pending.AskedAt)`.

#### Scenario: Elapsed time is derived from the command's own timestamp
- **WHEN** a `SubmitAnswer` command is executed with `At` later than the pending question's
  `AskedAt`
- **THEN** the recorded elapsed time for that submission equals the difference between the two
  instants, with no other time source involved

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

### Requirement: The pump advances until external input is required
After a command is applied, `GameEngine` SHALL repeatedly advance the state machine (resolving
questions, starting the next pick or turn, transitioning phases) without requiring further external
input, buffering every event generated, until the state machine is waiting on external input again
or the game finishes. A bounded iteration guard SHALL throw if exceeded, treating runaway pumping as
an engine bug.

#### Scenario: One command can produce a batch of events
- **WHEN** the final required answer to a question is submitted
- **THEN** `Execute` returns every event produced by resolving that question and starting whatever
  comes next, in one call, without the caller submitting any further command

### Requirement: Lobby phase legal commands
In the `Lobby` phase, `GameEngine` SHALL accept only `JoinGame`, `LeaveGame`, and `StartGame` (once
the minimum player count is met), rejecting every other command with `WrongPhase`.

#### Scenario: StartGame below minimum players is rejected
- **WHEN** `StartGame` is submitted while fewer than the minimum required players (per `GameRules`)
  have joined
- **THEN** the command is rejected with a rule-legality `RejectionCode` and the phase remains
  `Lobby`

#### Scenario: StartGame with enough players transitions to BaseSelection
- **WHEN** `StartGame` is submitted with at least the minimum required players joined
- **THEN** the command is accepted, the phase becomes `BaseSelection`, and a `BasePick` pending
  activity is created for the first player in seat order

### Requirement: Base selection legality
In the `BaseSelection` phase, `GameEngine` SHALL accept `SelectBase` only from the player named in
the current `BasePick` pending activity, for a region that is unowned and at least
`GameRules.MinimumBaseDistance` hops (via `AdjacencyIndex`) from every already-selected base — unless
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

### Requirement: IsBase is derived, never stored
Whether a region is a base SHALL be computed as `owner.BaseRegion == region.Id` at read time. No
`RegionState` field independently marks a region as a base.

#### Scenario: A region's base status always matches its owner's BaseRegion
- **WHEN** any `RegionState` is inspected after a base has been selected
- **THEN** that region reports `IsBase == true` if and only if some player's `BaseRegion` equals that
  region's id
