## REMOVED Requirements

### Requirement: The map supports pinch-zoom and drag-pan
**Reason**: This was added when the map used small, real-world-shaped regions close to the 44px
touch-target floor. `abstract-map-rework` replaced those with large, generic abstract shapes in a
fixed viewBox, removing the original justification. The game screen must now render at a fixed,
non-zoomable scale everywhere so it can reliably fit one viewport with no scroll.
**Migration**: None needed — pure client presentation, no persisted or API state involved.

### Requirement: A reset-view control returns the map to default zoom
**Reason**: This control only exists to recover from a zoomed state; since zoom is removed
entirely, there is no zoomed state to recover from.
**Migration**: None needed.

### Requirement: A landscape nudge appears on narrow portrait viewports during active gameplay
**Reason**: Forcing landscape orientation directly contradicts the new requirement that the whole
game screen fits on one viewport held naturally (typically portrait on a phone). The map no longer
needs extra horizontal space to be usable, since it renders at a fixed scale designed to fit
whatever viewport it's given.
**Migration**: None needed.

### Requirement: A fullscreen landscape lock is attempted on request, without being required
**Reason**: This existed solely to support the landscape nudge above; removed alongside it.
**Migration**: None needed.

### Requirement: The landscape nudge manages keyboard focus correctly
**Reason**: This existed solely to support the landscape nudge above; removed alongside it. The
underlying focus-trap utility remains in use elsewhere (e.g. the how-to-play modal) and is
unaffected.
**Migration**: None needed.

## ADDED Requirements

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
