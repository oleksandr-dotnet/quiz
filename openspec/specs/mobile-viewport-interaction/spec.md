# mobile-viewport-interaction Specification

## Purpose
Governs how the map and surrounding chrome behave on narrow/touch viewports: fitting the whole
game screen within one viewport with no scroll in any phase, rendering the map at a fixed
non-zoomable scale, and a minimum touch-target size for interactive controls.

## Requirements

### Requirement: The game screen fits the viewport without scrolling
On narrow viewports, the client SHALL lay out the map, player roster, and phase dock together so
they fit entirely within the visual viewport height, with no vertical or horizontal scroll, in
every gameplay phase (`BaseSelection`, `LandGrab`, `Battle`, `Finished`).

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
than the client's phone breakpoint.

#### Scenario: Dock buttons meet the minimum size on a phone viewport
- **WHEN** the viewport is narrower than the phone breakpoint
- **THEN** every dock button's rendered tappable area is at least 44x44 CSS pixels
