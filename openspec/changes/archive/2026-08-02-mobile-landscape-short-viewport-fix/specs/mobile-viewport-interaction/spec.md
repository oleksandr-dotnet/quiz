## MODIFIED Requirements

### Requirement: The game screen fits the viewport without scrolling
The client SHALL lay out the map, player roster, and phase dock together so they fit entirely
within the visual viewport height, with no vertical or horizontal scroll, in every gameplay phase
(`BaseSelection`, `LandGrab`, `Battle`, `Finished`) — on narrow viewports, and on any viewport short
enough to be a phone held in landscape regardless of its width.

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
