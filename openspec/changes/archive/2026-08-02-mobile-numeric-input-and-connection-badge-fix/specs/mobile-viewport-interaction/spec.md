## MODIFIED Requirements

### Requirement: The game screen fits the viewport without scrolling
The client SHALL lay out the map, player roster, and phase dock together so they fit entirely
within the visual viewport height, with no vertical or horizontal scroll, in every gameplay phase
(`BaseSelection`, `LandGrab`, `Battle`, `Finished`) — on narrow viewports, and on any viewport short
enough to be a phone held in landscape regardless of its width. This includes every control within
the dock and any status overlay rendered alongside the game screen: none of them SHALL overflow
their own container or push the fixed-height shell past the viewport.

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
