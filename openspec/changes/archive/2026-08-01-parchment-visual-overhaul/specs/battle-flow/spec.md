## ADDED Requirements

### Requirement: The nature of the current fight is projected to every viewer
While a Battle question or its reveal is pending, `GameView` SHALL carry which region is contested,
whether the fight is a duel or a base assault, who the attacker and defender are, and - for a base
assault - which question of the chain is being asked and how much damage has been dealt this turn.
This projection SHALL describe only facts both combatants already know (identities, the contested
region, assault progress), never an in-flight answer or the correct answer.

#### Scenario: A duel names the contested region and both combatants
- **WHEN** a duel question or its reveal is pending
- **THEN** every viewer's `GameView` identifies the contested region, the attacker, and the defender

#### Scenario: A base assault reports progress within the turn
- **WHEN** a base-assault question or its reveal is pending
- **THEN** every viewer's `GameView` identifies the assault's contested base region, the attacker,
  the defender, which question of the up-to-three-question chain is being asked, and how much damage
  has been dealt to the base so far this turn

#### Scenario: The battle context is absent outside of Battle questions
- **WHEN** the pending activity is not a duel or base-assault question or reveal (for example, a
  land-grab question, or no pending activity at all)
- **THEN** `GameView` carries no battle context

#### Scenario: Battle context never exposes an in-flight or correct answer
- **WHEN** a duel or assault question is pending and one combatant has already answered
- **THEN** the projected battle context contains no submitted value and no correct answer, exactly as
  the existing in-flight-secrecy requirement already guarantees for the question itself
