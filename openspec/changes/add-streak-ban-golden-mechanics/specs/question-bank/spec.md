## ADDED Requirements

### Requirement: Question selection can exclude specific categories for a game
The question repository SHALL support selecting a question while excluding a given set of categories,
for both the `choice` and `tip` pools, so that categories banned by `category-ban-draft` are never
drawn for the rest of that game. The canonical category set used for both the ban draft and this
exclusion SHALL be read from the repository's own loaded content, never a hardcoded duplicate list.

#### Scenario: A question is drawn excluding banned categories
- **WHEN** the engine requests a question for a game with one or more categories excluded
- **THEN** the returned question's category is never one of the excluded categories

#### Scenario: Excluding every eligible category still yields a question if any category remains
- **WHEN** a game excludes some but not all canonical categories for the relevant pool (choice or
  tip)
- **THEN** a question is still returned, drawn only from the categories that remain eligible

#### Scenario: The canonical category list is not duplicated
- **WHEN** the category ban draft or any exclusion check needs the full canonical category set
- **THEN** it is read from the same source the question repository already uses to validate content
  at startup, not a separately maintained list
