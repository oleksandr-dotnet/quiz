## MODIFIED Requirements

### Requirement: Lobby phase legal commands
In the `Lobby` phase, `GameEngine` SHALL accept only `JoinGame`, `LeaveGame`, and `StartGame` (once
the minimum player count is met), rejecting every other command with `WrongPhase`.

#### Scenario: StartGame below minimum players is rejected
- **WHEN** `StartGame` is submitted while fewer than the minimum required players (per `GameRules`)
  have joined
- **THEN** the command is rejected with a rule-legality `RejectionCode` and the phase remains
  `Lobby`

#### Scenario: StartGame transitions to CategoryBan when the draft is enabled
- **WHEN** `StartGame` is submitted with at least the minimum required players joined and
  `GameRules.EnableCategoryBanDraft` is `true`
- **THEN** the command is accepted and the phase becomes `CategoryBan`, per `category-ban-draft`

#### Scenario: StartGame transitions directly to BaseSelection when the draft is disabled
- **WHEN** `StartGame` is submitted with at least the minimum required players joined and
  `GameRules.EnableCategoryBanDraft` is `false`
- **THEN** the command is accepted, the phase becomes `BaseSelection`, and a `BasePick` pending
  activity is created for the first player in seat order, exactly as before the category ban draft
  capability existed

## ADDED Requirements

### Requirement: Three gameplay mechanics are independently host-configurable before start
`GameRules` SHALL carry three independent toggles - `EnableAnswerStreaks`, `EnableCategoryBanDraft`,
and `EnableGoldenQuestion` - each defaulting to `true`. Only the room's host SHALL be able to change
them, and only before `StartGame` is accepted; once accepted, the values in effect at that moment are
fixed for the rest of that game.

#### Scenario: Toggles default to enabled
- **WHEN** a room is created and no host settings command has been sent
- **THEN** `GameRules.EnableAnswerStreaks`, `EnableCategoryBanDraft`, and `EnableGoldenQuestion` are
  all `true` for that room

#### Scenario: The host can disable a mechanic before start
- **WHEN** the host sends a settings command turning one toggle off before `StartGame`
- **THEN** that toggle is `false` in the `GameRules` used once `StartGame` is accepted

#### Scenario: A non-host cannot change the settings
- **WHEN** a non-host player sends a settings command
- **THEN** the command is rejected and `GameRules`'s toggles are unchanged

#### Scenario: Settings are fixed once the game starts
- **WHEN** `StartGame` has been accepted
- **THEN** no later settings command changes that game's `GameRules` toggles, for the rest of the game

### Requirement: CategoryBan phase legal commands
In the `CategoryBan` phase, `GameEngine` SHALL accept only `ProposeCategoryBans` (once per active
player, per `category-ban-draft`) and `TimeoutElapsed`, rejecting every other command with
`WrongPhase` or the appropriate pending-activity rejection. Once every active player has submitted or
the deadline has passed, the phase resolves and transitions to `BaseSelection`.

#### Scenario: SelectBase while the ban draft is pending is rejected
- **WHEN** `SelectBase` is submitted while `Phase == CategoryBan`
- **THEN** the command is rejected with `WrongPhase`

#### Scenario: The draft resolving transitions into BaseSelection
- **WHEN** the last active player's proposal is submitted, or the draft's deadline passes via
  `TimeoutElapsed`
- **THEN** the engine resolves the draft per `category-ban-draft`, `Phase` becomes `BaseSelection`,
  and a `BasePick` pending activity is created for the first player in seat order
