## ADDED Requirements

### Requirement: Room language is fixed at creation and never re-derived
Every room SHALL have a single `Language` (Russian or English, defaulting to Russian) chosen when the
room is created, carried on that room's `GameRules` once `StartGame` builds `GameState`, and never
changed or re-derived from any later request, connection, or ambient setting for the lifetime of the
room.

#### Scenario: A room defaults to Russian when no language is chosen
- **WHEN** a room is created without an explicit language selection
- **THEN** the resulting `GameState.Rules.Language` is Russian

#### Scenario: A room's language is fixed once the game starts
- **WHEN** a room is created with a language selection and `StartGame` is executed
- **THEN** every subsequent command or view request for that room observes the same
  `GameState.Rules.Language`, regardless of which player or connection is asking
