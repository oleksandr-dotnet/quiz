# question-bank Specification

## Purpose
Governs the size, composition, and content quality of the bundled trivia question bank, so land grab
and battle questions stay varied, fair, and legitimately guessable.

## Requirements

### Requirement: Minimum question bank size
The trivia question bank (one JSON file per category under `src/UI/Triviador.Web/Data/questions/choice/` and `src/UI/Triviador.Web/Data/questions/tip/`) SHALL contain at least 2000 questions in total across all `choice` and `tip` files combined.

#### Scenario: Startup validation passes with the expanded bank
- **WHEN** the Web host starts and `QuestionRepository` loads every file under
  `Data/questions/choice/` and `Data/questions/tip/`
- **THEN** all files deserialize and pass all fail-fast validation (unique ids across every file
  combined, non-empty English and Russian text on every question, `options`/`optionsRu` arrays of
  equal length per choice question, `correctOptionIndex` within range, a known `category` matching
  the file it was loaded from, and a known `difficulty`) with at least 2000 questions present

### Requirement: Choice/tip composition ratio
The question bank SHALL maintain roughly a 2:1 ratio of `choice` questions to `tip` (numeric)
questions, so that both question kinds appear with healthy frequency during play.

#### Scenario: Composition check
- **WHEN** every file under `Data/questions/choice/` and `Data/questions/tip/` is counted
- **THEN** the combined `choice` files contain roughly 1330 questions and the combined `tip` files
  contain roughly 670 questions (a total of about 2000), keeping the ratio approximately 2:1

### Requirement: Category variety
The question bank SHALL span a broad variety of general-trivia categories, and SHALL NOT
reference specific game map regions or territories. Choice questions draw from a fixed 13-category
taxonomy (geography, history, science, nature, sports, pop-culture, technology, arts-literature,
mythology-religion, space-astronomy, food-drink, economy-business, language-wordplay). Tip
(numeric) questions draw from a fixed 8-category subset of that taxonomy (geography, history,
science, nature, sports, pop-culture, technology, economy-business), restricted to categories that
produce genuinely estimable numeric facts.

#### Scenario: Multiple categories represented in choice questions
- **WHEN** the `category` field across all `Data/questions/choice/` files is reviewed
- **THEN** at least 12 of the 13 canonical choice categories are represented, and no question's
  correctness depends on the game's conquest map layout

#### Scenario: Multiple categories represented in tip questions
- **WHEN** the `category` field across all `Data/questions/tip/` files is reviewed
- **THEN** at least 6 of the 8 canonical tip categories are represented

### Requirement: Bilingual completeness
Every question in the bank SHALL have complete, natural (non machine-garbled) English and Russian
text, and choice questions SHALL have equal-length, natural English and Russian option lists.

#### Scenario: Every question has both languages
- **WHEN** any question in any `choice` or `tip` file is inspected
- **THEN** its `text` and `textRu` fields are both non-empty natural-language sentences, and for
  choice questions, `options` and `optionsRu` have the same number of entries with a natural
  Russian translation for each English option

### Requirement: Estimable numeric questions
Tip/numeric questions SHALL be based on facts that are genuinely estimable (e.g. counts, dates,
measurements, distances, weights, populations, historical years) rather than arbitrary lookup facts
with no reasonable basis for a guess, so that the "closest guess wins" mechanic remains meaningful.
This is why tip questions are restricted to the 8-category subset described in the Category variety
requirement above — categories like mythology, arts, space, food, and language do not reliably
produce estimable numeric facts.

#### Scenario: Numeric question is guessable
- **WHEN** a `tip` question is presented to a player with general world knowledge
- **THEN** the player can reason toward a plausible estimate of `correctNumericValue` rather than
  needing to have memorized the exact figure verbatim

### Requirement: Unique, factually correct, non-duplicate content
Every question SHALL have a unique `id` across every file combined, a single unambiguous correct
answer, and SHALL NOT duplicate or near-duplicate another question's subject matter (including
across the choice/tip kind boundary). Choice questions SHALL have plausible, non-trivial distractor
options.

#### Scenario: No duplicate ids or subjects
- **WHEN** all 2000+ questions across every `choice` and `tip` file are compared
- **THEN** every `id` value is unique across all files combined, and no two questions ask about the
  same specific fact

#### Scenario: A pre-merge duplicate check is available
- **WHEN** a new batch of questions is authored and ready to merge
- **THEN** `tools/question-authoring/find-duplicates.mjs` can be run against the whole bank to
  surface likely near-duplicate pairs for human review before the batch is committed

#### Scenario: Distractors are plausible
- **WHEN** a choice question's incorrect options are reviewed
- **THEN** each distractor is a real, non-absurd value from the same category as the correct
  answer (not an obviously wrong filler option)

### Requirement: Every question declares a difficulty
Every question, choice or tip, SHALL declare a `difficulty` of `easy`, `medium`, or `hard`. Each
category SHALL contain at least one question of each difficulty level.

#### Scenario: Startup rejects an unknown difficulty
- **WHEN** the Web host starts and a question file contains a `difficulty` value other than
  `easy`, `medium`, or `hard`
- **THEN** `QuestionRepository` throws and the host fails to start

#### Scenario: Every difficulty is represented per category
- **WHEN** the questions for any single category are reviewed
- **THEN** at least one `easy`, one `medium`, and one `hard` question is present for that category

### Requirement: Question content is sharded one file per category
Question content SHALL be split into one JSON file per category, under
`Data/questions/choice/<category>.json` for choice questions and `Data/questions/tip/<category>.json`
for tip questions. Each question's declared `category` field SHALL match the filename it was loaded
from.

#### Scenario: Startup rejects a category/filename mismatch
- **WHEN** the Web host starts and a question's declared `category` does not match the filename of
  the file it was loaded from
- **THEN** `QuestionRepository` throws and the host fails to start

#### Scenario: Startup rejects an unknown category
- **WHEN** the Web host starts and a question's declared `category` is not one of the canonical
  categories for its kind (choice or tip)
- **THEN** `QuestionRepository` throws and the host fails to start
