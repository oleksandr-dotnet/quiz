## ADDED Requirements

### Requirement: Numeric reveals render as an archery target
When a resolved question's prompt kind is `Tip` (numeric), the client SHALL render an archery-target
visualization in place of a plain number line: concentric rings centered on a bullseye that
represents the correct answer, with one arrow per player who submitted a numeric answer.

#### Scenario: Bullseye represents the correct answer
- **WHEN** a `Tip` question's reveal data (`correctAnswer`, `answers[]`) is rendered
- **THEN** the target's center (bullseye) is labeled or associated with the correct answer value,
  matching what the previous number-line tick represented

#### Scenario: Choice-question reveals are unaffected
- **WHEN** a resolved question's prompt kind is `Choice`
- **THEN** the client renders the existing ranked list (laurel numeral, ✓/✗ mark, name, answer,
  speed bar) exactly as before, with no archery-target visualization

### Requirement: Arrow radius is proportional to answer error
Each player's arrow SHALL land at a distance from the bullseye that is a monotonic function of
`|player's numeric answer - correctAnswer|`, normalized against the spread of submitted answers for
that question, so that the closest guess lands nearest the center and the furthest guess lands
nearest the outer ring.

#### Scenario: The closest guess lands closest to center
- **WHEN** two or more players submit different numeric answers to the same `Tip` question
- **THEN** the player whose answer has the smallest absolute difference from `correctAnswer` has an
  arrow strictly closer to the bullseye than a player with a larger absolute difference

#### Scenario: An exact correct answer lands on the bullseye
- **WHEN** a player's submitted numeric answer equals `correctAnswer` exactly
- **THEN** that player's arrow renders at (or immediately adjacent to) the bullseye center

#### Scenario: A player who did not answer has no arrow
- **WHEN** a `RevealedAnswerView` entry has `answer.kind` of `None` (no submission)
- **THEN** the client does not render an arrow for that player on the target, consistent with the
  ranked list showing "—" for that row

### Requirement: Arrows land staggered by rank with a landing micro-animation
The client SHALL animate each arrow flying in and landing at its computed position, staggered in
rank order rather than landing all at once, and SHALL play a brief impact micro-animation
(e.g. a scale/shake "thunk") when an arrow lands.

#### Scenario: Arrows do not all land simultaneously
- **WHEN** three or more players have valid numeric answers for a resolved `Tip` question
- **THEN** their arrows' landing animations begin at different, rank-ordered offsets rather than all
  starting at the same instant

#### Scenario: Landing plays a brief impact effect
- **WHEN** an arrow's flight-in animation completes
- **THEN** the client plays a short, distinct micro-animation at that arrow's landing spot (e.g. a
  scale pulse or shake) rather than the arrow simply appearing motionless

### Requirement: Each landed arrow is labeled with its player
After an arrow lands, the client SHALL display a compact label identifying which player it belongs
to, colored with that player's seat color, so the same per-player information the ranked list and
former number-line pins conveyed is not lost.

#### Scenario: Landed arrows remain attributable
- **WHEN** an arrow has finished landing
- **THEN** a label showing that player's display name is visible near the arrow, rendered in that
  player's seat color (matching `colorForPlayer`/`SEAT_COLORS` used elsewhere in the reveal overlay)

### Requirement: The archery target respects reduced motion
When the viewer's OS-level `prefers-reduced-motion` setting is set to reduce, the client SHALL
render every arrow at its final landed position immediately, with no flight-in or impact animation,
while still showing the same rings, bullseye, arrow positions, and player labels.

#### Scenario: Reduced motion skips flight and impact animation
- **WHEN** `prefers-reduced-motion: reduce` is active and a `Tip` question reveal is shown
- **THEN** all arrows appear at their final positions with labels visible with no animated flight,
  stagger delay, or landing micro-animation, using the same durations-collapse-to-zero mechanism
  (`--dur-fast/mid/slow`) as the rest of the client

### Requirement: The archery target is usable on mobile-width viewports
The archery-target visualization SHALL remain legible and functional (rings, bullseye, arrows, and
labels all visible without overlap that hides information) at narrow mobile viewport widths, since
the game is played on phones as much as desktop.

#### Scenario: Labels do not overlap illegibly on a narrow viewport
- **WHEN** the archery target is rendered at a mobile-width viewport with the maximum supported
  player count
- **THEN** the target scales to fit the available width and player labels remain individually
  readable rather than fully overlapping each other
