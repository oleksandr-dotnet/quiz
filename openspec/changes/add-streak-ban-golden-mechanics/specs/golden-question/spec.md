## Purpose
Adds a rare, high-tension double-or-nothing question to each game, hidden from every player until
after it has already been answered, so a handful of otherwise-ordinary questions per game carry an
outsized, only-visible-in-hindsight stake.

## ADDED Requirements

### Requirement: A small, seeded number of questions per game are marked golden ahead of time
When `GameRules.EnableGoldenQuestion` is `true`, the engine SHALL designate between
`GameRules.GoldenQuestionMinCount` and `GameRules.GoldenQuestionMaxCount` (2 and 3 by default)
questions per game as golden, drawn using the room's seeded random source, and MAY mark a question of
any purpose - land grab, duel, base assault, self-heal, or numeric tiebreak - as golden. When the
toggle is `false`, no question in that game is ever golden and no part of this capability applies.

#### Scenario: A game has between 2 and 3 golden questions
- **WHEN** `GameRules.EnableGoldenQuestion` is `true` and a game runs its full course
- **THEN** the number of questions marked golden over the whole game is between
  `GameRules.GoldenQuestionMinCount` and `GameRules.GoldenQuestionMaxCount`

#### Scenario: Any question purpose is eligible
- **WHEN** the engine designates a golden question
- **THEN** that question may be a land-grab question, an ordinary duel, a base assault, a self-heal,
  or a numeric tiebreak

#### Scenario: Selection is deterministic for a given seed
- **WHEN** the same room seed and command log are replayed
- **THEN** the same questions are marked golden every time

#### Scenario: The feature is fully inert when disabled
- **WHEN** `GameRules.EnableGoldenQuestion` is `false`
- **THEN** no question is ever marked golden, no doubling ever applies, and no golden reveal is ever
  shown

### Requirement: Golden questions are spread out, never clustered
At least `GameRules.GoldenQuestionCooldownQuestions` questions of any purpose SHALL be asked between
any two golden questions in the same game.

#### Scenario: Golden questions are separated by a cooldown
- **WHEN** two golden questions occur in the same game
- **THEN** at least `GameRules.GoldenQuestionCooldownQuestions` non-golden questions were asked
  between them

### Requirement: Golden status is never revealed before that question resolves
No projected view, for any player, SHALL indicate that a pending or in-flight question is golden.
The golden flag SHALL first become visible only on the event that reveals that question's resolved
outcome, after every participant has answered or timed out.

#### Scenario: A pending golden question looks ordinary
- **WHEN** a golden question is currently pending (asked but not yet resolved)
- **THEN** no player's view indicates it is golden

#### Scenario: The golden flag appears only at reveal
- **WHEN** a golden question resolves
- **THEN** the resolution event carries the golden flag, visible to every participant and observer
  from that point on

### Requirement: A correct golden outcome doubles the question's own scoring or pick effect
When a golden question resolves, whatever scalar effect that resolution would otherwise have
produced SHALL be doubled, applied per question purpose as follows:
- Land grab: the award-queue pick counts for that question's ranking are doubled (4 picks for 1st,
  2 for 2nd, instead of 2 and 1), still truncated to the number of free regions remaining.
- Ordinary duel: if the defender successfully defends, the defender's `DuelDefenseScoreAwarded`
  amount is doubled. An attacker's capture is unaffected, since a single region has nothing scalar to
  double.
- Base assault: the `BaseAssaultScoreBonus` awarded to the winner (and lost by the loser) is doubled;
  if the attacker wins, the base hit-point damage for that one hit is doubled (2 instead of 1),
  still never reducing hit points below 0.
- Self-heal: a successful heal restores 2 hit points instead of 1, never exceeding the default
  maximum.
- Any streak bonus (per `answer-streaks`) awarded on the same correct answer is doubled alongside the
  question's own effect.
A tiebreak question triggered by a tied golden question is not itself independently golden; the
golden multiplier applies once, to the final outcome of the engagement the golden question belongs
to, however that outcome is ultimately decided.

#### Scenario: A golden land-grab question doubles the award queue
- **WHEN** a golden land-grab question resolves with a clear 1st and 2nd place
- **THEN** the 1st-ranked participant is queued 4 picks and the 2nd-ranked participant is queued 2
  picks, still truncated to the number of free regions remaining

#### Scenario: A golden duel defense doubles the defense bonus
- **WHEN** a golden ordinary-duel question resolves with the defender successfully defending
- **THEN** the defender's `DuelDefenseScoreAwarded` amount is `2 * GameRules.BaseAssaultScoreBonus`
  instead of the usual amount

#### Scenario: A golden base-assault hit doubles both the score bonus and the damage
- **WHEN** a golden base-assault question resolves with the attacker winning and the base's hit
  points remaining above zero afterward
- **THEN** the attacker's score gains `2 * GameRules.BaseAssaultScoreBonus`, the defender's score
  loses the same amount, and the base's hit points drop by 2 instead of 1

#### Scenario: A golden base-assault hit never drives hit points negative
- **WHEN** a golden base-assault question resolves with the attacker winning and the defender's base
  has only 1 hit point remaining
- **THEN** the base's hit points drop to 0 (a capture), not below 0, even though the golden multiplier
  would otherwise subtract 2

#### Scenario: A golden self-heal doubles the healing
- **WHEN** a player targets their own damaged base for a golden self-heal question and answers exactly
  correctly
- **THEN** their base hit points increase by 2 instead of 1, never exceeding the default maximum

#### Scenario: A golden streak-qualifying answer doubles the streak bonus too
- **WHEN** a golden question resolves correctly and that same correct answer also qualifies for a
  streak bonus
- **THEN** the streak bonus awarded for that answer is doubled alongside the question's own golden
  effect

#### Scenario: A golden tiebreak question is not separately golden
- **WHEN** a golden Choice-kind duel or base-assault question ties and triggers a numeric tiebreak
- **THEN** the tiebreak question itself carries no independent golden flag, and the golden doubling
  applies once, to the engagement's final outcome once the tiebreak decides it

### Requirement: The client gives a golden reveal a distinctly more elaborate presentation
When a resolved question's reveal is golden, the client SHALL play a visually distinct, more
elaborate reveal animation than an ordinary reveal, and a dedicated golden-reveal sound cue in
addition to (or replacing, for that reveal only) the ordinary correct/incorrect cue, subject to the
same mute control as every other audio cue.

#### Scenario: A golden reveal looks and sounds distinct
- **WHEN** a golden question's reveal is shown
- **THEN** the client plays a reveal animation and sound cue visibly and audibly distinct from an
  ordinary reveal

#### Scenario: Muting silences the golden reveal cue
- **WHEN** sound is muted and a golden question's reveal is shown
- **THEN** no audio plays, exactly as for any other muted reveal

#### Scenario: Reduced motion still conveys the golden outcome
- **WHEN** the viewer has reduced motion active
- **THEN** the golden reveal still visibly indicates the golden outcome and its doubled effect, using
  an instant state change instead of the elaborate animation
