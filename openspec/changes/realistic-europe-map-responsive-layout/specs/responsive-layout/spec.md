## ADDED Requirements

### Requirement: The app shell scales continuously from phone to large desktop viewports
The app shell SHALL size the game board and its surrounding layout responsively across the full
range from small phone widths to large (2K+) desktop widths, rather than capping at a fixed maximum
width that leaves unused margin on wide viewports.

#### Scenario: A 2K desktop viewport uses the extra space
- **WHEN** the app is viewed on a desktop viewport wider than the shell's previous fixed cap
- **THEN** the game board and dock grow to use the additional available width instead of stopping at
  a fixed pixel/rem width surrounded by empty margin

#### Scenario: A phone viewport keeps the board legible without horizontal scrolling
- **WHEN** the app is viewed on a small phone-width viewport
- **THEN** the game board, roster, and dock lay out in a single column that fits the viewport width
  with no horizontal scrollbar, and region shapes/labels remain legible

### Requirement: Board content scales with its container, not independently
Elements drawn inside the game board (region shapes, labels, adjacency lines, markers) SHALL scale
together with the board's container size, so enlarging the board on a wide viewport enlarges its
contents proportionally rather than leaving them a fixed pixel size within a larger empty frame.

#### Scenario: Labels grow with the board on a large viewport
- **WHEN** the board's container grows because of additional available viewport width
- **THEN** region labels and shapes grow proportionally with it, rather than staying a fixed pixel
  size while the surrounding board area grows
