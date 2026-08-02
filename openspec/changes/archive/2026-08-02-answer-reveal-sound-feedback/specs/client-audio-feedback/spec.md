## ADDED Requirements

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
