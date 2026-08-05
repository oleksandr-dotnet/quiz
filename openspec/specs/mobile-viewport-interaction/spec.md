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
scrollable rather than clipping content the viewer needs unreachable.

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
- **THEN** the numeric input field and its adjacent submit button both render fully inside the
  question card, with the input shrinking to make room rather than either element overflowing

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

