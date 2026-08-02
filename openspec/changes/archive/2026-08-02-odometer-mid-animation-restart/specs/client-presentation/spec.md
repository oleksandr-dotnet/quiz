## MODIFIED Requirements

### Requirement: Every state change the viewer caused or suffered has visible feedback
The client SHALL render a distinct, non-silent visual change - not merely a silent number or
fill-color update - whenever a new `GameView` snapshot differs from the previous one in a way that
affects the viewing player: a region they own changing hands, their base taking damage, their score
changing, or their elimination. This applies equally to a numeric answer entered through the on-screen
keypad or through direct keyboard input - both paths SHALL produce the same visible submitted-answer
feedback. When a single snapshot carries more than one such change at once (for example a base
assault's final hit that both captures a base and eliminates its owner), the client SHALL still
surface every one of them rather than only the highest-priority one, queuing proclamations that
cannot be shown simultaneously so each is still eventually seen. An animated score change that is
still in flight when a further score change arrives SHALL continue smoothly from wherever it
currently is, never visibly jumping backward to an earlier value first.

#### Scenario: A captured region does not change silently
- **WHEN** a snapshot shows a region's owner changed from the previous snapshot
- **THEN** the client plays a visible transition for that region rather than swapping its fill color
  between renders with no indication anything happened

#### Scenario: Concurrent significant transitions are all surfaced, not just one
- **WHEN** a single snapshot produces more than one proclamation-worthy transition (for example a
  `baseCaptured` and a `playerEliminated` from the same final hit)
- **THEN** the client eventually shows a proclamation for each of them, in the order they were
  produced, rather than showing only one and silently discarding the rest

#### Scenario: A map shake is not skipped because a proclamation is also showing
- **WHEN** a snapshot produces a `baseDamaged` transition in the same batch as a transition that
  also triggers a proclamation
- **THEN** the client still plays the map-shake feedback for the base damage, independent of
  whether a proclamation is shown for that same batch

#### Scenario: A score change arriving mid-animation does not jump backward
- **WHEN** the score display is still animating toward a value and a new score change arrives
  before that animation finishes
- **THEN** the new animation continues from the value currently on screen, never snapping back to
  an earlier number first
