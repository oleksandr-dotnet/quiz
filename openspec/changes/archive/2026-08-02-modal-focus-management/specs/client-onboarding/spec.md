## ADDED Requirements

### Requirement: The rules explainer manages keyboard focus correctly
The rules-explainer modal SHALL move keyboard focus into itself when it opens, trap Tab/Shift+Tab
navigation among its own focusable elements while open, and restore focus to whatever had it before
the modal opened once it closes.

#### Scenario: Opening the modal moves focus inside it
- **WHEN** the rules-explainer modal opens
- **THEN** keyboard focus is on an element inside the modal, not on any element behind it

#### Scenario: Tab does not leave the modal while it is open
- **WHEN** the rules-explainer modal is open and the player repeatedly presses Tab or Shift+Tab
- **THEN** focus cycles only among the modal's own focusable elements, never reaching an element on
  the page behind it

#### Scenario: Closing the modal returns focus to the trigger
- **WHEN** the rules-explainer modal closes
- **THEN** keyboard focus returns to the control that opened it
