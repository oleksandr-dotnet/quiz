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
outcome the UI shows SHALL come from a field the server already projected. This includes the region
graph itself: the client SHALL render regions as shapes/nodes positioned and sized from
server-projected data, and SHALL draw a connector line between two regions only when the
server-projected adjacency relation says they are adjacent, never from a client-side geographic
assumption.

#### Scenario: Eligible regions come from the server, not client computation
- **WHEN** the client highlights which regions are legal for the current player to pick or attack
- **THEN** the highlighted set is exactly the eligible-region list carried on the current `GameView`,
  not a set computed client-side from adjacency or distance rules

#### Scenario: Adjacency connector lines match the server's adjacency data
- **WHEN** the client renders the map
- **THEN** it draws exactly one connector line per adjacent region pair present in the current
  `GameView`'s region data, and no line for any pair the server does not report as adjacent

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
changing, or their elimination. This applies equally to a numeric answer entered through the on-screen
keypad or through direct keyboard input - both paths SHALL produce the same visible submitted-answer
feedback.

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

### Requirement: All client-rendered chrome text comes from the active locale's resource bundle
The client SHALL look up every user-facing string it renders (labels, buttons, placeholders, error and
rejection messages, phase/status text) from the active locale's resource bundle rather than a hardcoded
literal, defaulting to Russian, with English as the only other supported locale.

#### Scenario: The default locale is Russian
- **WHEN** the client starts with no locale previously chosen for this session
- **THEN** every rendered string comes from the Russian resource bundle

#### Scenario: A room's language drives its chrome once joined
- **WHEN** the client is connected to a room whose `GameView`/`RoomView` reports a language
- **THEN** the client renders that room's screens using the resource bundle matching that language,
  regardless of any locale chosen before joining

### Requirement: Numeric answers accept both an on-screen keypad and physical keyboard input
When a pending question calls for a numeric answer, the client SHALL present a clickable on-screen
keypad (digits, backspace, submit) in addition to accepting direct physical-keyboard typing, and both
input paths SHALL update the same underlying answer value so either one, or a mix of both, produces a
correct submission.

#### Scenario: A numeric answer built by mouse clicks alone submits correctly
- **WHEN** a player builds a numeric answer using only on-screen keypad button clicks and then submits
- **THEN** the submitted value equals the digits clicked, in the order clicked

#### Scenario: A numeric answer built by physical keyboard alone submits correctly
- **WHEN** a player types a numeric answer using only their physical keyboard and then submits
- **THEN** the submitted value equals the digits typed, in the order typed

#### Scenario: Mixing keypad clicks and physical typing keeps one consistent value
- **WHEN** a player enters some digits via the on-screen keypad and others via physical keyboard typing
  into the same pending question
- **THEN** the displayed and submitted value reflects every entered digit in the order entered,
  regardless of which input path produced each digit

### Requirement: A viewer's own winning outcome receives a distinct celebratory presentation
When the viewer's own player is among `outcome.winnerPlayerIds` on a `Finished` `GameView`, the client SHALL present a visually distinct celebratory treatment beyond the shared winner headline shown to every viewer (winners, losers, and draws alike) - so winning reads as an occasion, not the same generic outcome screen with different text.

#### Scenario: The viewer's own win is celebrated
- **WHEN** the client's own player id is in `outcome.winnerPlayerIds` and there is exactly one
  winner
- **THEN** the results screen plays a celebratory animation (e.g. gilt spark/banner flourish)
  in addition to the winner headline

#### Scenario: A loss or draw does not play the winner celebration
- **WHEN** the viewer's own player id is not in `outcome.winnerPlayerIds`, or `winnerPlayerIds`
  contains more than one player (a draw)
- **THEN** the client does not play the winning-player celebratory animation, though the shared
  outcome headline and standings are still shown

#### Scenario: Reduced motion still shows the outcome
- **WHEN** `prefers-reduced-motion: reduce` is active and the viewer won
- **THEN** the client shows the same winner state (headline, standings, winner banner) without the
  animated celebration effect
