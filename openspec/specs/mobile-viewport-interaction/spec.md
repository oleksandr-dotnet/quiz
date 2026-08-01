# mobile-viewport-interaction Specification

## Purpose
Governs how the map and surrounding chrome behave on narrow/touch viewports: zoom/pan gestures, a
landscape nudge during active gameplay, an optional fullscreen-landscape lock, and a minimum
touch-target size for interactive controls.

## Requirements

### Requirement: The map supports pinch-zoom and drag-pan
The client SHALL let the viewer zoom the map in and out with a two-pointer pinch gesture (or mouse
wheel on desktop) within a fixed scale range, and pan the zoomed map with a single-pointer drag,
without changing the underlying `GameView` or region click semantics.

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

### Requirement: A reset-view control returns the map to default zoom
Once the map's scale is not 1, the client SHALL show a control that immediately returns the map to
its default scale and centered position.

#### Scenario: Reset view appears only when zoomed
- **WHEN** the map's scale is exactly 1
- **THEN** no reset-view control is shown

#### Scenario: Reset view restores default framing
- **WHEN** the viewer activates the reset-view control after zooming and/or panning
- **THEN** the map's scale returns to 1 and its pan offset returns to centered, in one action

### Requirement: A landscape nudge appears on narrow portrait viewports during active gameplay
The client SHALL show a dismissible overlay suggesting the viewer rotate their device to landscape
when the viewport is portrait-oriented and narrower than the client's phone breakpoint, and the
current game phase is one where the map is the primary interaction (base selection, land grab, or
battle) — not in the lobby, landing screen, or results screen.

#### Scenario: The nudge shows on a narrow portrait viewport during gameplay
- **WHEN** the viewport is portrait-oriented and narrower than the phone breakpoint, and the current
  `GameView.phase` is `BaseSelection`, `LandGrab`, or `Battle`
- **THEN** the client shows the rotate-device overlay

#### Scenario: The nudge does not show outside active gameplay phases
- **WHEN** the viewport is portrait-oriented and narrower than the phone breakpoint, but the viewer
  is on the landing screen, in the lobby, or viewing results
- **THEN** the client does not show the rotate-device overlay

#### Scenario: Dismissing the nudge reveals the game underneath
- **WHEN** the viewer dismisses the rotate-device overlay
- **THEN** the overlay closes and the game beneath it is fully usable, for the remainder of that
  orientation

#### Scenario: Rotating back to portrait re-prompts after a dismissal in landscape
- **WHEN** the viewer dismissed the overlay, then rotated to landscape, then rotated back to
  portrait while still in an active gameplay phase
- **THEN** the rotate-device overlay is shown again

### Requirement: A fullscreen landscape lock is attempted on request, without being required
When the viewer requests it from the rotate-device overlay, the client SHALL attempt to enter
fullscreen and lock the screen orientation to landscape, but SHALL NOT treat failure or absence of
either browser API as an error condition visible to the viewer.

#### Scenario: The lock attempt succeeds on a supporting browser
- **WHEN** the viewer requests fullscreen-and-lock on a browser supporting both the Fullscreen API
  and `screen.orientation.lock`
- **THEN** the client enters fullscreen and the device orientation locks to landscape

#### Scenario: The lock attempt is a silent no-op on an unsupporting browser
- **WHEN** the viewer requests fullscreen-and-lock on a browser missing the Fullscreen API or the
  Orientation Lock API (for example iOS Safari)
- **THEN** the client does not show an error, and the rotate-device overlay's manual "continue in
  portrait" dismissal remains available

### Requirement: Interactive controls meet a minimum touch-target size on narrow viewports
The client SHALL give every interactive control the viewer taps to act (dock buttons, answer
options, the numeric keypad) a tappable area of at least 44 by 44 CSS pixels, on viewports narrower
than the client's phone breakpoint.

#### Scenario: Dock buttons meet the minimum size on a phone viewport
- **WHEN** the viewport is narrower than the phone breakpoint
- **THEN** every dock button's rendered tappable area is at least 44x44 CSS pixels
