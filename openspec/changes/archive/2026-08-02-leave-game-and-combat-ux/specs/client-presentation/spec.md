## ADDED Requirements

### Requirement: A contested region under a duel or enemy-base assault is visibly more alarming than eligible-region highlighting
The client SHALL render the contested region of an in-progress duel or an assault on someone else's
base (a battle context whose attacker and defender are different players) with a distinct,
more attention-grabbing animated treatment than the calmer eligible-region outline, for as long as
the fight remains in progress (its question or reveal is pending).

#### Scenario: A duel's contested region is visibly under attack
- **WHEN** a duel between two different players is in progress
- **THEN** the contested region shows the escalated under-attack treatment for as long as the
  question or its reveal is pending

#### Scenario: An assault on another player's base shows the same escalated treatment
- **WHEN** an assault on a base belonging to a player other than the attacker is in progress
- **THEN** the contested base region shows the escalated under-attack treatment for as long as the
  question or its reveal is pending

#### Scenario: A self-heal shows no escalated treatment
- **WHEN** a player targets their own base (attacker and defender are the same player)
- **THEN** the region does not receive the escalated under-attack treatment, since nothing is
  actually at risk

### Requirement: An assault on the viewer's own base gets a distinctly more intense presentation than any other contested region
The client SHALL present a more intense, urgent effect than the general contested-region treatment
whenever an assault targets the viewer's own base and the attacker is a different player - reflecting
that the viewer's elimination is on the line - for as long as that assault's question or reveal is
pending.

#### Scenario: The viewer's own base under assault is unmistakably urgent
- **WHEN** the viewer's own base is the target of an assault by another player
- **THEN** the client presents an effect distinctly more intense than the general contested-region
  treatment used for a duel or another player's base, for as long as that assault remains in progress

#### Scenario: Another player's base under assault does not trigger the viewer's own-base urgency
- **WHEN** a base belonging to a player other than the viewer is under assault by yet another player
- **THEN** the viewer sees only the general contested-region treatment, not the own-base urgency
  effect

#### Scenario: A self-heal never triggers the own-base urgency effect
- **WHEN** the viewer targets their own base for a self-heal
- **THEN** the own-base urgency effect does not play, since the viewer is not in danger

#### Scenario: Reduced motion still conveys urgency
- **WHEN** `prefers-reduced-motion: reduce` is active and the viewer's own base is under assault
- **THEN** the client still visibly marks the base as under attack, without the animated pulse/shake
