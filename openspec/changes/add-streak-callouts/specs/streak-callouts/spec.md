## ADDED Requirements

### Requirement: A player's answer streak crossing a milestone produces a room-wide proclamation
The client SHALL show every player in the room a localized proclamation when any player's answer
streak crosses one of the milestone thresholds (4, 6, 7, and every third value after 7), escalating
in tone across three tiers.

#### Scenario: A player reaches their first milestone
- **WHEN** a player's answer streak increases from below 4 to 4 or above in one snapshot
- **THEN** every client in the room shows a tier-1 proclamation naming that player

#### Scenario: A player reaches a higher milestone
- **WHEN** a player's answer streak crosses 6 or 7 (or a later `+3` threshold)
- **THEN** every client shows the correspondingly higher-tier proclamation, cycling back to tier 3's
  message for thresholds past the third

#### Scenario: A streak resetting produces no callout
- **WHEN** a player's answer streak decreases (streak broken)
- **THEN** no streak-milestone proclamation fires

### Requirement: A streak milestone plays a tiered sound cue
The client SHALL play a synthesized sound cue alongside the proclamation, more elaborate at higher
tiers, respecting the existing mute setting.

#### Scenario: Sound respects mute
- **WHEN** the player has muted sound
- **THEN** no streak-milestone cue plays, identically to every other sound cue
