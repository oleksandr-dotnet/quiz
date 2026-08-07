## MODIFIED Requirements

### Requirement: Every pending activity shows an actor, a countdown, and an affordance
The client SHALL display, for every pending activity `GameView` carries (a base pick, a category-ban
proposal, a land-grab question, an attack-target selection, a battle question, or a reveal), who is
acting, the time remaining until its deadline, and - when the viewer is that actor - a usable
affordance to act.

#### Scenario: Waiting on another player is visibly different from waiting on yourself
- **WHEN** a pending activity names a player other than the viewer as the current actor
- **THEN** the client shows that player's name and the remaining time, and does not present the
  viewer with an affordance to act on their behalf

#### Scenario: A bot's or disconnected player's turn still reads as intentional
- **WHEN** the current actor on a pending activity is a bot, or a human known to be disconnected
- **THEN** the client's countdown display still runs to the deadline rather than appearing frozen or
  broken, since the turn is expected to resolve by timeout

#### Scenario: A category-ban proposal shows every player's submission state
- **WHEN** the category ban draft is pending
- **THEN** the client shows, for every active player, whether they have submitted their proposal yet,
  the remaining time, and - for the viewer - a usable picker to choose up to 3 categories

## ADDED Requirements

### Requirement: Every category is rendered with a distinct icon in the ban picker
When the client shows the category ban picker, it SHALL render each category alongside a distinct
icon or emoji, so a player can recognize a category faster than reading its label alone.

#### Scenario: Every category has a distinct icon
- **WHEN** the category ban picker is shown
- **THEN** every category listed shows an icon or emoji distinct from every other listed category's

#### Scenario: A newly added category still renders with a fallback icon
- **WHEN** the picker shows a category that has no explicitly mapped icon
- **THEN** the client shows a generic fallback icon rather than omitting an icon or breaking the
  layout
