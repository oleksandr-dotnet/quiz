## MODIFIED Requirements

### Requirement: The map supports pinch-zoom and drag-pan
The client SHALL let the viewer zoom the map in and out with a two-pointer pinch gesture (or mouse
wheel on desktop) within a fixed scale range, and pan the zoomed map with a single-pointer drag,
without changing the underlying `GameView` or region click semantics. A stray extra pointer landing
and lifting during an active pinch SHALL NOT interrupt that pinch, as long as at least two pointers
remain down throughout.

#### Scenario: Pinching zooms the map
- **WHEN** the viewer places two pointers on the map and increases the distance between them
- **THEN** the map's visual scale increases up to the maximum supported zoom level, centered on the
  pinch midpoint

#### Scenario: Dragging pans a zoomed map
- **WHEN** the map's scale is greater than 1 and the viewer drags with a single pointer
- **THEN** the map's visible offset follows the drag, clamped so no empty space beyond the map's
  edge is ever revealed

#### Scenario: Dragging at default zoom does not pan the map
- **WHEN** the map's scale is exactly 1 (not zoomed in) and the viewer drags with a single pointer
  starting on the map
- **THEN** the map does not pan, and the surrounding page scrolls normally instead

#### Scenario: A region tap still selects correctly while zoomed
- **WHEN** the map is zoomed and/or panned and the viewer taps a region
- **THEN** the same region under the viewer's finger is selected, exactly as it would be at default
  zoom

#### Scenario: A stray third pointer does not freeze an active pinch
- **WHEN** a pinch is active with two pointers down, a third pointer lands and then lifts, and the
  original two pointers continue moving
- **THEN** the pinch continues responding to the two remaining pointers' movement without needing
  every pointer to lift and the gesture to restart
