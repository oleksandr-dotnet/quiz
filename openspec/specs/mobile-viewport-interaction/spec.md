# mobile-viewport-interaction Specification

## Purpose
Governs how the map and surrounding chrome behave on narrow/touch viewports: fitting the whole
game screen within one viewport with no scroll in any phase, rendering the map at a fixed
non-zoomable scale, and a minimum touch-target size for interactive controls.
## Requirements
### Requirement: The game screen fits the viewport without scrolling
The client SHALL lay out the map, player roster, and phase dock together so they fit entirely
within the visual viewport height, with no vertical or horizontal scroll, in every gameplay phase
(`BaseSelection`, `LandGrab`, `Battle`, `Finished`) — on narrow viewports, and on any viewport short
enough to be a phone held in landscape regardless of its width. This includes every control within
the dock and any status overlay rendered alongside the game screen: none of them SHALL overflow
their own container or push the fixed-height shell past the viewport. When a phase's dock content
genuinely cannot fit even after the map has shrunk to its minimum, the dock SHALL become internally
scrollable rather than clipping content the viewer needs unreachable, and SHALL show a visible fade
cue on whichever edge (top and/or bottom) still has more content to reveal, tracking actual scroll
position rather than a static hint. A `Tip` (numeric) question SHALL offer exactly one submit
control rather than duplicating submit affordances, since a redundant control costs vertical budget
without adding capability. The per-player "who has answered" roster SHALL render fully visible,
without needing the dock's scroll fallback, for a typical-length `Choice` question. On a viewport
tall enough that the laid-out content doesn't fill it while the map's row is collapsed (hidden
during a question or reveal), the leftover vertical space SHALL be distributed above and below the
content rather than left entirely below the dock.

#### Scenario: The map shrinks to fit rather than the page growing
- **WHEN** the combined natural height of the top bar, roster, and dock leaves less room than the
  map's natural aspect ratio would otherwise take
- **THEN** the map's rendered height shrinks to whatever space remains, rather than the page
  growing taller than the viewport

#### Scenario: A long question with a full set of answer options produces no scrollbar
- **WHEN** a `Choice` question with lengthy text and four answer options is the pending activity on
  a narrow viewport
- **THEN** the game screen shows no scrollbar in either direction, in any phase

#### Scenario: Rotating the device re-fits without introducing scroll
- **WHEN** the viewport's orientation changes while a gameplay phase is active
- **THEN** the layout re-fits the new viewport dimensions with no scroll appearing

#### Scenario: A wide-but-short landscape phone still gets the fitted layout
- **WHEN** the viewport is wider than the narrow-viewport width threshold but short enough to be a
  phone held in landscape (for example 932×430 or 975×450)
- **THEN** the client still applies the fitted, non-scrolling layout rather than falling back to
  the wider desktop layout

#### Scenario: A numeric question's input-and-submit row stays within its card
- **WHEN** a `Tip` (numeric) question is pending on the narrowest viewport widths this project
  targets (as narrow as 393px)
- **THEN** the numeric input field renders fully inside the question card, with the input shrinking
  to make room rather than overflowing

#### Scenario: Only one submit control is offered for a numeric answer
- **WHEN** a `Tip` (numeric) question is pending, on any viewport, in either Land Grab or Battle
- **THEN** the question card offers exactly one visible submit button (the numeric keypad's
  full-width submit) rather than a second duplicate submit control next to the input

#### Scenario: The answer roster is visible without scrolling for a typical question
- **WHEN** a `Choice` question of typical (non-outlier) prompt and option length is pending on any
  of the project's narrow target viewports (393-421px wide)
- **THEN** the per-player "who has answered" roster renders fully within the visible dock area with
  no scroll needed to reach it

#### Scenario: A connection-status banner never pushes the game shell past the viewport
- **WHEN** the room connection's `status` becomes `reconnecting` or `closed` while a gameplay phase
  is active on a narrow or short-landscape viewport
- **THEN** the resulting status banner overlays the game screen instead of adding height above the
  fixed-height shell, and the game screen underneath remains fully visible with no clipping

#### Scenario: A reveal row's name and answer columns truncate instead of overlapping
- **WHEN** a `RevealOverlay`'s ranked list shows a player name or answer text too long for its
  column's fixed or flexible width
- **THEN** that column's text truncates with an ellipsis rather than overlapping the neighboring
  column

#### Scenario: A stacked reveal-and-next-question dock stays reachable via scroll
- **WHEN** LandGrab briefly renders a reveal overlay together with the next pending question (both
  numeric, the tallest combination) and their combined height exceeds what the map shrinking to
  zero can accommodate
- **THEN** the dock becomes internally scrollable so the next question's controls remain reachable,
  rather than being clipped past the viewport with no way to reach them

#### Scenario: A scrollable dock shows a fade cue only where there's more to reveal
- **WHEN** `.shell-dock`'s content exceeds its visible height (its scroll fallback is active) on any
  target viewport
- **THEN** a visible fade appears at the top edge only if there's hidden content above the current
  scroll position, and at the bottom edge only if there's hidden content below it — neither fade
  shows when the dock isn't scrollable, and the bottom fade disappears once scrolled to the end

#### Scenario: The fade cue tracks real scrolling, not a static hint
- **WHEN** the viewer scrolls a dock that was showing a bottom fade, reaching the end of its content
- **THEN** the bottom fade disappears and, if content above is now hidden, a top fade appears instead

#### Scenario: Leftover space on a tall phone is split above and below, not dumped at the bottom
- **WHEN** the map is hidden (a question or reveal is showing) on a phone viewport tall enough that
  the top bar, roster, and dock don't fill it (for example OnePlus 13R's ~840px viewport)
- **THEN** the leftover vertical space is distributed both above the top bar and below the dock,
  rather than all of it collecting below the dock alone

#### Scenario: A viewport where content already fills the shell is unaffected
- **WHEN** the map is hidden on a viewport where the laid-out content already fills the available
  height (for example iPhone 16's 659px viewport)
- **THEN** the layout is unchanged, since there is no leftover space to redistribute

### Requirement: The map renders at a fixed, non-zoomable scale
The client SHALL render the map at a fixed scale with no user-driven zoom or pan; a tap or click on
a region SHALL select that region directly, with no gesture layer intervening.

#### Scenario: No gesture changes the map's scale or pan offset
- **WHEN** the viewer pinches, drags, or scrolls the mouse wheel over the map
- **THEN** the map's scale and position do not change

#### Scenario: Region selection is unaffected by the removed gesture layer
- **WHEN** the viewer taps or clicks a region
- **THEN** that region is selected, exactly as before this change

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
- **WHEN** the viewport is as narrow as 393-421px wide (this project's three concrete target
  devices: iPhone 16 at 393px, iPhone 17 at 402px, OnePlus 13R at ~421px) and a roster card shows a
  short (3-8 character) name, including with a full 4-player roster and the swatch/HP-pips/score
  segments all present
- **THEN** the full name renders without ellipsis truncation, wrapping onto its own line ahead of
  the swatch/HP/score segments if needed rather than being squeezed to zero width

#### Scenario: A long unbroken lobby seat name truncates instead of displacing its action button
- **WHEN** a lobby seat shows a long, unbroken (no-space) display name on a narrow phone viewport
- **THEN** the name truncates with an ellipsis and the seat's action button (fill-with-bot/open
  seat) remains fully visible within the row

### Requirement: Landing and Lobby remain scrollable when their content exceeds the viewport
The client SHALL NOT apply the in-game fitted-viewport's document-level scroll lockout to the
landing screen or the lobby screen — neither renders the gameplay shell the lockout exists to
backstop, and both are expected to scroll normally on any viewport short enough that their content
doesn't fit, including short-landscape phones.

#### Scenario: The Join Room button remains reachable on a short landscape viewport
- **WHEN** the viewport is short enough (landscape or otherwise) that the landing screen's content
  is taller than the visible viewport
- **THEN** the document remains scrollable and the Join Room button can be reached by scrolling

#### Scenario: The Start Game button remains reachable on a short landscape viewport
- **WHEN** the viewport is short enough that the lobby screen's content is taller than the visible
  viewport
- **THEN** the document remains scrollable and the Start Game button can be reached by scrolling

#### Scenario: The in-game no-scroll behavior is unaffected
- **WHEN** a gameplay phase (`BaseSelection`, `LandGrab`, `Battle`, `Finished`) is active
- **THEN** the document-level scroll lockout still applies exactly as before, with no regression to
  the existing "game screen fits the viewport without scrolling" requirement

### Requirement: A base's wax seal remains legible at the map's mobile-breakpoint scale
The client SHALL render a base region's wax-seal marker - its disc, monogram, and hit-point pips -
large enough to be individually distinguishable on narrow viewports, even though the map itself is
capped to a small rendered height at that breakpoint.

#### Scenario: A base's hit-point pips are individually distinguishable during target selection
- **WHEN** the map is visible on a narrow viewport (as narrow as 393px) with at least one base owned
  by an active player
- **THEN** the wax seal's hit-point pips render large enough, and far enough apart, to be counted at
  a glance rather than blurring into an indistinct dot

#### Scenario: A scaled-up wax seal does not overlap neighboring map elements
- **WHEN** a wax seal is enlarged for legibility on a narrow viewport
- **THEN** it does not visually overlap an adjacent region's value badge, connector line, or another
  base's wax seal

### Requirement: A reveal row's answer text stays legible across the project's full phone range
The client SHALL apply the Reveal overlay's narrow-column layout (the one that favors the answer
text's share of row width) on every viewport width within the project's documented phone range, not
only the narrowest phones, so that an ordinary-length answer (e.g. a date or a multi-word place name)
remains distinguishable rather than collapsing to one or two characters.

#### Scenario: A date answer remains distinguishable on a mid-range phone width
- **WHEN** a Reveal overlay's ranked list shows answer text such as a full date on a viewport around
  420px wide
- **THEN** enough of the answer renders before truncation that different players' answers remain
  visually distinguishable from one another, not all collapsed to the same one or two leading
  characters

