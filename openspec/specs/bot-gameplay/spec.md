# bot-gameplay Specification

## Purpose
TBD - created by archiving change add-bot-ai-decisions. Update Purpose after archive.
## Requirements
### Requirement: A bot seat acts on every pending activity it owns
The room SHALL eventually submit a command on behalf of any bot-seated `PlayerId` a pending
activity requires input from, through the same command surface a human client uses (`SelectBase`,
`PickRegion`, `SubmitAnswer`, `SelectAttackTarget`), before that activity's deadline elapses in the
normal case. A bot never requires a `RevealHold` to be acknowledged, since no player (bot or human)
acts on a reveal.

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

### Requirement: A bot's choice uses only information a human player would have
A bot's chosen region, target, or answer SHALL be selected only from the same eligible-choice sets
and prompt information already exposed to human clients (via the engine's `EligibleBaseRegions`,
`EligibleRegionsFor`, `EligibleAttackTargetsFor`, and a `Question`'s `Prompt`). A bot SHALL never
have access to a question's correct option index or correct numeric value, or to any other
server-internal state not already projected to a human viewer.

#### Scenario: A bot guesses a trivia answer blind
- **WHEN** a bot seat answers a trivia question
- **THEN** its answer is chosen without reading that question's correct answer, the same
  information limit a human player faces

#### Scenario: A bot only ever picks from the currently eligible set
- **WHEN** a bot seat picks a base, a land-grab region, or an attack target
- **THEN** the chosen value is always a member of that decision's currently eligible set, and is
  therefore always accepted by the engine's own validation

### Requirement: A bot's submission is delayed to read as human-paced, not instant or deadline-locked
A bot SHALL NOT submit its command the instant it becomes eligible to act, nor always wait until
the deadline. The room SHALL introduce a randomized delay, scaled to the activity's remaining time,
before submitting a bot's command.

#### Scenario: A bot does not answer instantly
- **WHEN** a bot becomes an active participant in a pending activity
- **THEN** its command is not submitted in the same tick the activity began, but after a randomized
  delay

#### Scenario: A bot's delay never exceeds the activity's own deadline
- **WHEN** a bot's randomized thinking delay is computed for a pending activity
- **THEN** the delay never causes the bot's submission to be attempted after that activity's
  deadline; if it would, the existing timeout fallback resolves the activity instead

### Requirement: A bot's own timing never lets another participant's action change its already-scheduled choice or delay
One participant answering a pending `Question` SHALL NOT reschedule, cancel, or alter the delay or
chosen answer already committed for any other bot participant still pending, whether the question
has multiple bot participants or a mix of bot and human participants.

#### Scenario: A human answering first does not rush or delay a bot's own answer
- **WHEN** a human participant submits an answer to a question a bot is also participating in
- **THEN** the bot's own previously-scheduled answer delay and chosen value are unaffected

### Requirement: A stale bot submission is a harmless no-op
A bot's scheduled submission SHALL be rejected exactly as any other stale or out-of-turn command is,
with no error raised and no effect on the room, if it arrives after the activity it targeted is no
longer pending (for example, the activity resolved via timeout first, or the same bot already
submitted for it).

#### Scenario: A bot's delayed submission arrives after the deadline already resolved the activity
- **WHEN** a bot's scheduled command is submitted for an activity that has already resolved via
  `TimeoutElapsed`
- **THEN** the command is rejected the same way any stale-token command is, and the room's state is
  unaffected

### Requirement: A seat converted to bot control mid-activity is scheduled immediately, not on the next transition
A seat that becomes bot-controlled while a pending activity already requires its input SHALL have a
bot move scheduled for that same pending activity right away, using the same eligible-choice
derivation and human-paced delay any other bot move uses - not only starting from the next pending
activity.

#### Scenario: A newly bot-controlled seat's current turn is still scheduled
- **WHEN** a seat becomes bot-controlled while it is the current actor on a pending base pick,
  land-grab pick, attack-target selection, or an unanswered question participant
- **THEN** a bot move for that same pending activity is scheduled immediately, exactly as it would be
  had the seat already been bot-controlled when the activity began

