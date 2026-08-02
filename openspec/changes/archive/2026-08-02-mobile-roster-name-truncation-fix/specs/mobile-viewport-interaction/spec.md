## MODIFIED Requirements

### Requirement: Interactive controls meet a minimum touch-target size on narrow viewports
The client SHALL give every interactive control the viewer taps to act (dock buttons, answer
options, the numeric keypad) a tappable area of at least 44 by 44 CSS pixels, on viewports narrower
than the client's phone breakpoint, and SHALL keep each roster card's player-name field wide enough
to render a short (3-8 character) player name in full without ellipsis truncation at the narrowest
viewport widths this breakpoint covers.

#### Scenario: Dock buttons meet the minimum size on a phone viewport
- **WHEN** the viewport is narrower than the phone breakpoint
- **THEN** every dock button's rendered tappable area is at least 44x44 CSS pixels

#### Scenario: A short default name renders in full on the narrowest supported phone widths
- **WHEN** the viewport is as narrow as 430-450px wide (the narrowest phones this project targets)
  and a roster card shows a short name such as the default bot label
- **THEN** the full name renders without ellipsis truncation
