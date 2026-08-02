## ADDED Requirements

### Requirement: A failed clipboard-copy action is never silent
Whenever the client attempts to copy text to the clipboard (an invite link or a result summary)
and that attempt fails, the client SHALL show a visible error rather than leaving the click with no
observable effect.

#### Scenario: A failed invite-link copy shows an error
- **WHEN** the player activates "Copy invite link" and the clipboard write rejects
- **THEN** the client shows a visible error instead of no feedback at all

#### Scenario: A failed result copy shows an error
- **WHEN** the player activates "Copy result" and the clipboard write rejects
- **THEN** the client shows a visible error instead of no feedback at all

#### Scenario: A successful copy is unaffected
- **WHEN** the clipboard write succeeds
- **THEN** the client shows the existing "Copied!" confirmation exactly as before
