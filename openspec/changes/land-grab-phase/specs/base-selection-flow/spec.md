## REMOVED Requirements

### Requirement: Base selection's end is visible even though the next phase isn't built yet
**Reason**: Land grab is now implemented, so base selection's end no longer needs a dead-end state -
it flows directly into the first land-grab question. Superseded by "Base selection's end flows
directly into land grab" below.
**Migration**: None required; this was a client-visible waiting state, not a stored piece of state or
an API a caller depended on.

## ADDED Requirements

### Requirement: Base selection's end flows directly into land grab
Once every occupied seat has picked a base, every player SHALL be shown the land-grab phase beginning
- a question being asked to every active player - with no intervening "waiting" or dead-end state.

#### Scenario: All bases are picked
- **WHEN** the last occupied seat picks its base
- **THEN** every player's view transitions directly to the first land-grab question, with no
  "complete" or "not built yet" state shown in between
