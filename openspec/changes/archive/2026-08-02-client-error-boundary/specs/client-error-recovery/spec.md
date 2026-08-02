## ADDED Requirements

### Requirement: A render error is contained to a themed fallback screen
The client SHALL catch any uncaught render error thrown by a component in the app tree and render a
themed fallback screen in place of the crashed subtree, rather than letting the error unmount the
whole React tree to a blank page.

#### Scenario: A component render error shows the fallback, not a blank page
- **WHEN** any component within the app shell throws during render
- **THEN** the client displays the fallback screen instead of a blank/white page

#### Scenario: The fallback is styled consistently with the rest of the client
- **WHEN** the fallback screen is shown
- **THEN** it uses the client's existing parchment/paper visual theme (tokens/classes already used
  elsewhere in the client), not the browser's default unstyled error output

### Requirement: The fallback screen offers a reload action
The fallback screen SHALL present a single clear action that reloads the page, giving the player a
way to recover without needing to know to manually refresh the browser.

#### Scenario: The reload action reloads the page
- **WHEN** the player activates the fallback screen's reload action
- **THEN** the page performs a full reload

### Requirement: A caught render error is logged for diagnosis
When the client catches a render error, it SHALL log the error and its component stack to the
console, so the failure is diagnosable from browser dev tools or console capture without being
silently swallowed.

#### Scenario: The error and component stack are logged
- **WHEN** a component render error is caught
- **THEN** the error object and its component stack trace both appear in the console
