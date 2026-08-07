## ADDED Requirements

### Requirement: A golden reveal plays a distinct, dedicated audio cue
When a resolved question's reveal is golden (per `golden-question`), the client SHALL play a
dedicated golden-reveal sound cue, distinct from the ordinary correct/incorrect chime, timed to that
reveal. It SHALL be silenced by the same mute control as every other reveal cue.

#### Scenario: A golden reveal plays its own cue
- **WHEN** a golden question's reveal is displayed
- **THEN** the client plays the dedicated golden-reveal cue, distinct from the ordinary
  correct/incorrect chime

#### Scenario: Muting silences the golden-reveal cue
- **WHEN** sound is muted and a golden question's reveal is displayed
- **THEN** no audio plays for that reveal

#### Scenario: An ordinary reveal is unaffected
- **WHEN** a non-golden question's reveal is displayed
- **THEN** only the existing correct/incorrect cue plays, exactly as before this capability existed
