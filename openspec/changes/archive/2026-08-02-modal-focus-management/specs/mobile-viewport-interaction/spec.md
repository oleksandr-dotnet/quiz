## ADDED Requirements

### Requirement: The landscape nudge manages keyboard focus correctly
The rotate-device overlay SHALL move keyboard focus into itself when it appears, trap Tab/Shift+Tab
navigation among its own focusable elements while shown, and restore focus to whatever had it
before the overlay appeared once it is dismissed.

#### Scenario: The overlay appearing moves focus inside it
- **WHEN** the rotate-device overlay appears
- **THEN** keyboard focus is on an element inside the overlay, not on any element behind it

#### Scenario: Tab does not leave the overlay while it is shown
- **WHEN** the rotate-device overlay is shown and the viewer repeatedly presses Tab or Shift+Tab
- **THEN** focus cycles only among the overlay's own focusable elements, never reaching an element
  on the page behind it

#### Scenario: Dismissing the overlay returns focus sensibly
- **WHEN** the rotate-device overlay is dismissed
- **THEN** keyboard focus returns to whatever element had it before the overlay appeared
