## ADDED Requirements

### Requirement: A failed room command never leaves the landing screen permanently disabled
The client SHALL recover the landing screen's actions to a usable state whenever a create/join-room
command fails for any reason, including the underlying network call itself rejecting (not only a
resolved rejection reason from the server).

#### Scenario: A rejected network call still recovers the UI
- **WHEN** the underlying create/join-room call rejects (e.g. the connection is down) rather than
  resolving with a rejection reason
- **THEN** the client shows an error message and every landing-screen action button becomes usable
  again

#### Scenario: A server-side rejection still recovers the UI
- **WHEN** the create/join-room call resolves with a rejection reason
- **THEN** the client shows that reason and every landing-screen action button becomes usable again
