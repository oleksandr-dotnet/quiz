# client-audio-feedback Specification

## Purpose
Governs the client's audible correct/incorrect cue at each answer reveal, and the mute control
that silences it.

## Requirements

### Requirement: A reveal plays an audible cue matching the viewer's own correctness
The client SHALL play a distinct correct-answer chime when the viewer's own submitted answer was
correct, and a distinct incorrect-answer cue when it was wrong, once per resolved question, timed to
that question's reveal.

#### Scenario: A correct answer plays the chime
- **WHEN** a question resolves and the viewer's own submitted answer matches the correct answer
- **THEN** the client plays the correct-answer chime

#### Scenario: An incorrect answer plays the buzz
- **WHEN** a question resolves and the viewer's own submitted answer does not match the correct
  answer
- **THEN** the client plays the incorrect-answer cue

#### Scenario: No submission plays no cue
- **WHEN** a question resolves and the viewer submitted no answer
- **THEN** the client plays neither cue

#### Scenario: Each reveal plays its cue only once
- **WHEN** a single resolved question's reveal is displayed
- **THEN** at most one cue plays for that question, regardless of re-renders while the reveal is
  visible

### Requirement: Sound is mutable and the preference persists
The client SHALL provide a visible mute control that silences every sound cue when active, and the
mute preference SHALL persist across page reloads and sessions, defaulting to unmuted.

#### Scenario: Muting silences reveal cues
- **WHEN** sound is muted and a question resolves
- **THEN** no audio plays for that reveal

#### Scenario: The mute preference survives a reload
- **WHEN** the viewer mutes sound and then reloads the page
- **THEN** sound remains muted after the reload

#### Scenario: Sound defaults to on
- **WHEN** the viewer has never set a mute preference
- **THEN** sound cues play normally (unmuted)

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
