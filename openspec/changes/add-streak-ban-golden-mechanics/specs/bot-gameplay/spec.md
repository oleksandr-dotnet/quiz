## MODIFIED Requirements

### Requirement: A bot seat acts on every pending activity it owns
The room SHALL eventually submit a command on behalf of any bot-seated `PlayerId` a pending
activity requires input from, through the same command surface a human client uses (`SelectBase`,
`PickRegion`, `SubmitAnswer`, `SelectAttackTarget`, `ProposeCategoryBans`), before that activity's
deadline elapses in the normal case. A bot never requires a `RevealHold` to be acknowledged, since no
player (bot or human) acts on a reveal.

#### Scenario: A bot's base pick
- **WHEN** it becomes a bot seat's turn to pick a base
- **THEN** the room submits a `SelectBase` command for that bot choosing one of the currently
  eligible regions, before the turn's deadline

#### Scenario: A bot's land-grab region pick
- **WHEN** it becomes a bot seat's turn to pick a land-grab region
- **THEN** the room submits a `PickRegion` command for that bot choosing one of the currently
  eligible regions, before the turn's deadline

#### Scenario: A bot answers a trivia question
- **WHEN** a bot seat is an active participant in a pending `Question` and has not yet submitted an
  answer
- **THEN** the room submits a `SubmitAnswer` command for that bot before the question's deadline,
  independently of when any other participant answers

#### Scenario: A bot's attack target selection
- **WHEN** it becomes a bot seat's turn to select an attack target
- **THEN** the room submits a `SelectAttackTarget` command for that bot choosing one of the
  currently eligible targets, before the turn's deadline

#### Scenario: A bot's category-ban proposal
- **WHEN** a bot seat is an active participant in a pending category ban draft and has not yet
  submitted a proposal
- **THEN** the room submits a `ProposeCategoryBans` command for that bot, choosing up to 3 categories,
  before the draft's deadline
