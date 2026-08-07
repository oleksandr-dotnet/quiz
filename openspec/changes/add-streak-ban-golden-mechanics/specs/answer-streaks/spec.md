## Purpose
Rewards consistently correct answers across the whole game with a scaling score bonus and a visible,
tiered badge at the player's avatar, so a run of correct answers builds its own escalating tension.

## ADDED Requirements

### Requirement: A per-player streak tracks consecutive correct answers across every question type
Each player SHALL have a streak counter that increments by 1 on every correct answer they submit to
any question - land grab, ordinary duel, base assault, self-heal, or numeric tiebreak - and resets to
0 on any incorrect answer or non-submission (timeout) to any of those question types. The counter
persists for the whole game; it is not reset at phase or round boundaries. This requirement applies
only when `GameRules.EnableAnswerStreaks` is `true`; when `false`, no streak is tracked and every
scenario in this capability does not apply.

#### Scenario: A correct answer extends the streak
- **WHEN** a player answers any question correctly while their streak is at N
- **THEN** their streak becomes N + 1

#### Scenario: An incorrect answer resets the streak
- **WHEN** a player answers any question incorrectly
- **THEN** their streak becomes 0

#### Scenario: A timeout resets the streak
- **WHEN** a player's deadline passes on any question without a submission
- **THEN** their streak becomes 0

#### Scenario: The streak survives a phase transition
- **WHEN** a player's streak is above 0 at the moment land grab ends and battle begins
- **THEN** their streak carries into battle unchanged, and their next correct answer in battle
  extends it further

#### Scenario: Streaks are not tracked when the feature is disabled
- **WHEN** `GameRules.EnableAnswerStreaks` is `false`
- **THEN** no player's streak changes on any answer, no bonus is ever awarded by this capability, and
  no streak badge is shown

### Requirement: Each correct answer awards bonus score scaling with the streak already built
When a player's streak increments from N to N + 1 (N >= 1) on a correct answer, that player's
non-territory score (the same `BonusScore` channel `GameRules.BaseAssaultScoreBonus` already uses)
SHALL increase by `N * GameRules.AnswerStreakBonusPerStreak` (50 by default). The first correct
answer of a new streak (N = 0 to 1) awards 0, since there is no prior streak length to scale from.

#### Scenario: A mid-streak correct answer awards a scaled bonus
- **WHEN** a player's streak is 2 and they answer another question correctly
- **THEN** their streak becomes 3 and their score increases by `2 * GameRules.AnswerStreakBonusPerStreak`
  (100 by default)

#### Scenario: The first correct answer of a streak awards nothing
- **WHEN** a player's streak is 0 and they answer a question correctly
- **THEN** their streak becomes 1 and no bonus score is awarded

#### Scenario: A longer streak awards a proportionally larger bonus
- **WHEN** a player's streak is 6 and they answer another question correctly
- **THEN** their streak becomes 7 and their score increases by `6 * GameRules.AnswerStreakBonusPerStreak`
  (300 by default)

#### Scenario: The bonus participates in end-of-game scoring
- **WHEN** the game ends by round limit
- **THEN** every player's accumulated streak bonus is included in `GameState.ScoreOf` exactly as
  territory value and other bonus score already are

### Requirement: A streak-bonus award is announced as its own event
Whenever a correct answer awards a non-zero streak bonus, the engine SHALL emit an event carrying the
player, their new streak count, and the bonus amount awarded, distinct from and in addition to that
question's own resolution event, so a client can play a dedicated "streak bonus" animation.

#### Scenario: A qualifying correct answer emits a streak event
- **WHEN** a player's streak increments from 2 to 3 on a correct answer
- **THEN** an event is emitted carrying that player's id, a streak count of 3, and a bonus amount of
  `2 * GameRules.AnswerStreakBonusPerStreak`

#### Scenario: A non-qualifying correct answer emits no streak event
- **WHEN** a player's streak increments from 0 to 1 on a correct answer
- **THEN** no streak-bonus event is emitted, since the awarded bonus is 0

### Requirement: The current streak and its tier are visible at every player's avatar
Every player's projected view SHALL include each active player's current streak count. Wherever
player avatars are rendered (the roster and any in-game player chip), the client SHALL show that
player's streak count with a tier-specific visual treatment: a streak of 1-3 renders in a bronze
color, 4-5 in a silver color, and 6 or more in a gold color; a streak of 7 or more additionally
renders with an animated rainbow effect layered on the gold treatment. A streak of 0 shows no badge.

#### Scenario: A bronze-tier streak is shown
- **WHEN** a player's streak is between 1 and 3
- **THEN** their avatar shows a streak badge in the bronze color

#### Scenario: A silver-tier streak is shown
- **WHEN** a player's streak is 4 or 5
- **THEN** their avatar shows a streak badge in the silver color

#### Scenario: A gold-tier streak is shown
- **WHEN** a player's streak is 6
- **THEN** their avatar shows a streak badge in the gold color, without the rainbow effect

#### Scenario: A rainbow gold-tier streak is shown
- **WHEN** a player's streak is 7 or more
- **THEN** their avatar shows the gold streak badge with an added animated rainbow effect

#### Scenario: A broken streak shows no badge
- **WHEN** a player's streak is 0
- **THEN** their avatar shows no streak badge

#### Scenario: Reduced motion suppresses the rainbow animation
- **WHEN** the viewer has reduced motion active (per `client-presentation`)
- **THEN** a streak of 7 or more still renders in gold, but without the animated rainbow effect
