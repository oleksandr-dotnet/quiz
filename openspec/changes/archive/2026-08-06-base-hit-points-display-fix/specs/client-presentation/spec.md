## ADDED Requirements

### Requirement: The roster and battle headline show the true base hit-point maximum
The client SHALL render exactly `GameRules.BaseHitPointsDefault` hit-point pips per base owner in the
player roster, and any hit-count text (such as a base-assault turn's headline) SHALL state that same
maximum and a 1-based question count within the current chain - never a value stale from an earlier
balance change, and never the server's internal 0-based question index shown directly.

#### Scenario: The roster shows one pip per point of the true maximum
- **WHEN** the player roster renders a base owner's hit-point pips
- **THEN** it renders exactly `GameRules.BaseHitPointsDefault` pips, with the leading
  `player.baseHitPoints` of them filled and the rest hollow

#### Scenario: A base-assault headline's stated maximum matches the real one
- **WHEN** a base-assault question's headline reports "hit N of M"
- **THEN** M equals `GameRules.BaseHitPointsDefault`, and N is 1 for the first question of the current
  chain (not the server's 0-based internal index)
