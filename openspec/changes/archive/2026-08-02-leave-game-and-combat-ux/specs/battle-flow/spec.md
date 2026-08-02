## ADDED Requirements

### Requirement: A player's own damaged base is a legal, opt-in attack target
`EligibleAttackTargetsFor` SHALL include a player's own base region as an attack target exactly when
base assaults are unlocked for the current round and that player's base hit points are below the
default maximum. It SHALL NOT be offered when the player's base is already at full hit points, or
before base assaults unlock for the round, exactly matching the timing already governing assaults on
an enemy base.

#### Scenario: A damaged base can target itself once assaults unlock
- **WHEN** it is a player's turn to select an attack target, base assaults are unlocked for the
  current round, and that player's own base hit points are below the default maximum
- **THEN** that player's own base region is included among their eligible attack targets

#### Scenario: A full-health base cannot target itself
- **WHEN** a player's own base hit points are already at the default maximum
- **THEN** that player's own base region is not included among their eligible attack targets,
  regardless of whether base assaults are unlocked

#### Scenario: Self-targeting is unavailable before base assaults unlock
- **WHEN** base assaults are not yet unlocked for the current round
- **THEN** a player's own base region is not included among their eligible attack targets, even if it
  is damaged

### Requirement: Targeting your own base starts a one-question self-heal, not a duel or a multi-question assault
Selecting your own base as an attack target SHALL ask exactly one question to that player alone.
Answering it exactly correctly SHALL increase that player's base hit points by 1, never exceeding the
default maximum. Answering incorrectly, answering inexactly (a numeric answer that is not the exact
correct value), or not answering SHALL leave hit points unchanged. Either outcome SHALL end the turn
after that one question - self-heal never chains additional questions the way an assault on an enemy
base can.

#### Scenario: A correct answer heals the base by 1
- **WHEN** a player targets their own damaged base and answers the resulting question exactly
  correctly
- **THEN** their base hit points increase by 1 and the turn ends

#### Scenario: An incorrect or inexact answer changes nothing
- **WHEN** a player targets their own damaged base and answers the resulting question incorrectly, or
  gives a numeric answer that is not the exact correct value
- **THEN** their base hit points are unchanged and the turn ends

#### Scenario: Not answering changes nothing
- **WHEN** a player targets their own damaged base and the question's deadline elapses with no answer
  submitted
- **THEN** their base hit points are unchanged and the turn ends

#### Scenario: Healing never exceeds the default maximum
- **WHEN** a player's base hit points are already one below the default maximum and they heal
  successfully
- **THEN** their base hit points equal the default maximum, and no further healing is possible until
  the base is damaged again
