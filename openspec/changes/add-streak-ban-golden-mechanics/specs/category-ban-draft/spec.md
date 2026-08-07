## Purpose
Lets players shape the trivia deck before a game begins by proposing categories they'd rather not
face, so every game's question pool carries a small, player-driven exclusion instead of being
entirely fixed.

## ADDED Requirements

### Requirement: A category ban draft runs once, between the lobby and base selection
When `GameRules.EnableCategoryBanDraft` is `true`, the engine SHALL enter a `CategoryBan` phase
immediately after `StartGame` is accepted, before `BaseSelection` begins. When the toggle is `false`,
`StartGame` SHALL transition directly to `BaseSelection` exactly as it does today, and no part of
this capability applies.

#### Scenario: The draft phase starts a game when enabled
- **WHEN** `StartGame` is accepted and `GameRules.EnableCategoryBanDraft` is `true`
- **THEN** `Phase` becomes `CategoryBan` and every active player is shown the full set of available
  categories with a time-limited proposal window

#### Scenario: The draft phase is skipped when disabled
- **WHEN** `StartGame` is accepted and `GameRules.EnableCategoryBanDraft` is `false`
- **THEN** `Phase` becomes `BaseSelection` directly, exactly as before this capability existed

### Requirement: Every player proposes up to 3 categories from the full canonical set
While `CategoryBan` is pending, every active player SHALL be able to submit a proposal of up to 3
distinct categories, drawn from the full canonical category taxonomy the question repository exposes
(not a hardcoded list), within `GameRules.CategoryBanProposalDurationSeconds`. A player may submit
fewer than 3, or explicitly submit none. A player may not submit more than once; a later submission
from the same player before the deadline SHALL be rejected.

#### Scenario: A player proposes 3 categories
- **WHEN** an active player submits a proposal of 3 distinct categories before the deadline
- **THEN** the proposal is recorded for that player, and other players see that this player has
  submitted, but not which categories they chose

#### Scenario: A player proposes fewer than 3
- **WHEN** an active player submits a proposal of 1 or 2 distinct categories
- **THEN** the partial proposal is recorded for that player exactly as submitted

#### Scenario: A player submits an empty proposal
- **WHEN** an active player explicitly submits a proposal with zero categories
- **THEN** an empty proposal is recorded for that player, distinct from never having submitted at all

#### Scenario: A second submission from the same player is rejected
- **WHEN** a player who has already submitted a proposal submits another before the deadline
- **THEN** the second submission is rejected and their original proposal is unchanged

#### Scenario: An unresponsive player's slot is resolved without a proposal
- **WHEN** a player has not submitted any proposal by the deadline
- **THEN** they are treated at resolution as having proposed no categories, exactly as an explicit
  empty proposal is

### Requirement: Each player's ban is drawn from that player's own proposal, in seat order
Once every active player has submitted or the deadline has passed, the engine SHALL resolve one
banned category per active player, in seat order, using the room's seeded random source:
- If that player's proposal has at least one category, one category SHALL be drawn at random from
  that player's own proposal.
- If that player's proposal is empty, one category SHALL be drawn at random from the full canonical
  category set, excluding any category already banned by an earlier-resolved player in this same
  draft.
Two different players' draws MAY land on the same category; the total number of distinct banned
categories for the game MAY therefore be fewer than the number of active players.

#### Scenario: A player's ban is drawn from their own proposal
- **WHEN** a player proposed 3 categories
- **THEN** exactly one of those 3 categories is banned as that player's contribution, chosen by the
  room's seeded random source

#### Scenario: An empty proposal draws from the remaining pool
- **WHEN** a player proposed no categories
- **THEN** one category is drawn at random from the full canonical set, excluding categories already
  banned earlier in the same resolution, as that player's contribution

#### Scenario: Two players' draws can collide
- **WHEN** two different players' random draws select the same category
- **THEN** that category is banned once, and the game's total banned-category count is smaller than
  the number of active players

#### Scenario: Resolution is deterministic for a given seed
- **WHEN** the same room seed and the same set of player proposals are replayed
- **THEN** the resulting set of banned categories is identical every time

### Requirement: Banned categories are excluded from question selection for the rest of the game
Once the draft resolves, every category it banned SHALL be excluded from question selection - both
`choice` and `tip` pools - for every remaining question asked in that game, across land grab, duels,
base assaults, self-heals, and tiebreaks.

#### Scenario: A banned category never appears in a question
- **WHEN** a category was banned by the draft
- **THEN** no question from that category, choice or tip, is asked for the remainder of the game

#### Scenario: Unbanned categories are asked normally
- **WHEN** a category was not banned by the draft
- **THEN** questions from that category continue to be eligible for selection exactly as before this
  capability existed

### Requirement: The draft resolution is visible to every player
Once the draft resolves, every player's view SHALL show the final set of banned categories. The
engine SHALL NOT expose any player's individual proposal to another player before resolution.

#### Scenario: The banned set is shown after resolution
- **WHEN** the category ban draft resolves
- **THEN** every player's view lists the resulting banned categories

#### Scenario: In-flight proposals stay private
- **WHEN** the draft is still pending and one player has already submitted
- **THEN** no other player's view reveals which categories that player proposed
