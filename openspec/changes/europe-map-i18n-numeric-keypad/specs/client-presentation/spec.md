## MODIFIED Requirements

### Requirement: The client renders projected state only
The client SHALL derive everything it displays from the server-projected `GameView` (and its
predecessor snapshot for diffing) alone. It SHALL NOT re-derive game rules - such as base-pick
legality, attack-target legality, scoring, or elimination - from raw domain state; any legality or
outcome the UI shows SHALL come from a field the server already projected. This includes the region
graph itself: the client SHALL render regions as nodes positioned and sized from server-projected
data, and SHALL draw a connector line between two regions only when the server-projected adjacency
relation says they are adjacent, never from a client-side geographic assumption.

#### Scenario: Eligible regions come from the server, not client computation
- **WHEN** the client highlights which regions are legal for the current player to pick or attack
- **THEN** the highlighted set is exactly the eligible-region list carried on the current `GameView`,
  not a set computed client-side from adjacency or distance rules

#### Scenario: Adjacency connector lines match the server's adjacency data
- **WHEN** the client renders the map
- **THEN** it draws exactly one connector line per adjacent region pair present in the current
  `GameView`'s region data, and no line for any pair the server does not report as adjacent

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

## ADDED Requirements

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
