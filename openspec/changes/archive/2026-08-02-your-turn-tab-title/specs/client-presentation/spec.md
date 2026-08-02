## ADDED Requirements

### Requirement: The document title signals when it is the viewer's turn to act
The client SHALL set the document title to a localized "Your turn!" variant whenever the viewer
currently needs to act - as the current base/land-grab picker, the current attacker choosing a
target, or an unanswered participant in a pending question - and SHALL revert to the plain app
title as soon as none of those apply.

#### Scenario: The title flips when a pending pick is the viewer's
- **WHEN** the viewer is the current base-selection or land-grab region picker
- **THEN** the document title reads the "Your turn!" variant

#### Scenario: The title flips when the viewer must choose an attack target
- **WHEN** the viewer is the current attacker choosing a target in Battle
- **THEN** the document title reads the "Your turn!" variant

#### Scenario: The title flips while the viewer has an unanswered pending question
- **WHEN** a question is pending, the viewer is a participant, and the viewer has not yet answered
- **THEN** the document title reads the "Your turn!" variant

#### Scenario: The title reverts once it is no longer the viewer's turn
- **WHEN** the viewer has just answered the pending question, or is not the current picker/attacker
- **THEN** the document title reverts to the plain app title

#### Scenario: The title stays plain outside active gameplay
- **WHEN** the viewer is on the landing screen, in the lobby, or viewing results
- **THEN** the document title is the plain app title
