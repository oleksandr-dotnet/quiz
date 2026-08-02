## ADDED Requirements

### Requirement: A duel or enemy-base assault starting plays an audible cue
The client SHALL play a distinct "attack started" sound cue once when a duel or an assault on another
player's base begins (attacker and defender are different players), independent of and in addition to
the existing reveal correct/incorrect cues. It SHALL NOT play again for subsequent questions within
the same multi-question assault chain against the same target, and SHALL NOT play for a self-heal.

#### Scenario: A new duel plays the attack-started cue once
- **WHEN** a duel between two different players begins
- **THEN** the client plays the attack-started cue exactly once for that duel

#### Scenario: A new assault on another player's base plays the attack-started cue once
- **WHEN** an assault on a base belonging to a player other than the attacker begins
- **THEN** the client plays the attack-started cue exactly once for that assault's first question

#### Scenario: A chained assault question does not replay the cue
- **WHEN** an assault chain against the same base continues to a second or third question within the
  same turn
- **THEN** the attack-started cue does not play again for those later questions

#### Scenario: A self-heal plays no attack-started cue
- **WHEN** a player targets their own base for a self-heal
- **THEN** the client does not play the attack-started cue

#### Scenario: Muting silences the attack-started cue
- **WHEN** sound is muted and a duel or enemy-base assault begins
- **THEN** no audio plays
