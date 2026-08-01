# client-presentation Specification

## Purpose
Describes the client's rendering obligations: render server-projected state only (never re-derive
game rules), give every pending activity a visible actor/countdown/affordance, give every state
change the player caused or suffered visible feedback, surface connection loss, and honour
reduced-motion - so the UI never claims more knowledge than the server actually gave it and never
leaves a player looking at a frozen or silently-stuck screen.

## Requirements

### Requirement: The client renders projected state only
The client SHALL derive everything it displays from the server-projected `GameView` (and its
predecessor snapshot for diffing) alone. It SHALL NOT re-derive game rules - such as base-pick
legality, attack-target legality, scoring, or elimination - from raw domain state; any legality or
outcome the UI shows SHALL come from a field the server already projected.

#### Scenario: Eligible regions come from the server, not client computation
- **WHEN** the client highlights which regions are legal for the current player to pick or attack
- **THEN** the highlighted set is exactly the eligible-region list carried on the current `GameView`,
  not a set computed client-side from adjacency or distance rules

### Requirement: Every pending activity shows an actor, a countdown, and an affordance
The client SHALL display, for every pending activity `GameView` carries (a base pick, a land-grab
question, an attack-target selection, a battle question, or a reveal), who is acting, the time
remaining until its deadline, and - when the viewer is that actor - a usable affordance to act.

#### Scenario: Waiting on another player is visibly different from waiting on yourself
- **WHEN** a pending activity names a player other than the viewer as the current actor
- **THEN** the client shows that player's name and the remaining time, and does not present the
  viewer with an affordance to act on their behalf

#### Scenario: A bot's or disconnected player's turn still reads as intentional
- **WHEN** the current actor on a pending activity is a bot, or a human known to be disconnected
- **THEN** the client's countdown display still runs to the deadline rather than appearing frozen or
  broken, since the turn is expected to resolve by timeout

### Requirement: Every state change the viewer caused or suffered has visible feedback
The client SHALL render a distinct, non-silent visual change - not merely a silent number or
fill-color update - whenever a new `GameView` snapshot differs from the previous one in a way that
affects the viewing player: a region they own changing hands, their base taking damage, their score
changing, or their elimination.

#### Scenario: A captured region does not change silently
- **WHEN** a snapshot shows a region's owner changed from the previous snapshot
- **THEN** the client plays a visible transition for that region rather than swapping its fill color
  between renders with no indication anything happened

### Requirement: Connection loss and room closure are surfaced
The client SHALL render the room connection's `status` and `closedReason` fields whenever they
indicate anything other than a normal connected state, rather than leaving the player looking at a
frozen or silently-stuck screen.

#### Scenario: A dropped connection is visible
- **WHEN** the room connection status becomes `reconnecting`
- **THEN** the client displays a visible reconnecting indicator until the status returns to
  connected or becomes `closed`

#### Scenario: A closed room explains why
- **WHEN** the room connection status becomes `closed` with a `closedReason`
- **THEN** the client displays that reason to the player instead of leaving them on the last-seen
  game screen with no explanation

### Requirement: Reduced motion collapses animation to instant state changes
When the viewer's OS-level `prefers-reduced-motion` setting is set to reduce, the client SHALL
present every state change from the transitions/feedback requirements above instantly, with no
animated transition, while still rendering the same information.

#### Scenario: Reduced motion still shows the same outcome
- **WHEN** `prefers-reduced-motion: reduce` is active and a region is captured
- **THEN** the client shows the region's new owner immediately, with no animated sweep or delay, and
  no layout shift or clipped content as a result of skipping the animation
