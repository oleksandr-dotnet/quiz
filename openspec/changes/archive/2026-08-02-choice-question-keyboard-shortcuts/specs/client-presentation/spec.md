## ADDED Requirements

### Requirement: Choice-question numbered hints are backed by keyboard shortcuts
The client SHALL let the viewer submit a `Choice` question option by pressing its corresponding
number key (1-4, top-row or numpad), matching the numbered hint glyph already rendered on each
option, while that question is pending and unanswered by the viewer.

#### Scenario: Pressing a number key submits the matching option
- **WHEN** a `Choice` question is pending, the viewer has not yet answered it, and the viewer
  presses the number key matching one of the rendered options
- **THEN** the client submits that option, identical to clicking it

#### Scenario: The shortcut does nothing once answered
- **WHEN** the viewer has already answered the current question
- **THEN** pressing a number key does not resubmit or change the answer

#### Scenario: The shortcut does nothing during a numeric question
- **WHEN** a `Tip` (numeric) question is pending
- **THEN** pressing a number key is handled by the numeric input/keypad as digit entry, not as an
  option-submission shortcut

#### Scenario: Modifier-held presses are ignored
- **WHEN** the viewer presses a number key while holding Ctrl, Alt, or Meta
- **THEN** the client does not submit an option, leaving the browser/OS shortcut for that key
  combination unaffected
