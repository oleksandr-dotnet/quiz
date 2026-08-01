# question-bank Specification

## Purpose
Governs the size, composition, and content quality of the bundled trivia question bank, so land grab
and battle questions stay varied, fair, and legitimately guessable.

## Requirements

### Requirement: Minimum question bank size
The trivia question bank (`src/UI/Triviador.Web/Data/questions/questions.json`) SHALL contain at
least 100 questions in total across the `choice` and `tip` arrays combined.

#### Scenario: Startup validation passes with the expanded bank
- **WHEN** the Web host starts and `QuestionRepository` loads `questions.json`
- **THEN** the file deserializes and passes all existing fail-fast validation (unique ids across
  both arrays, non-empty English and Russian text on every question, `options`/`optionsRu` arrays
  of equal length per choice question, `correctOptionIndex` within range) with at least 100
  questions present

### Requirement: Choice/tip composition ratio
The question bank SHALL maintain roughly a 2:1 ratio of `choice` questions to `tip` (numeric)
questions, so that both question kinds appear with healthy frequency during play.

#### Scenario: Composition check
- **WHEN** the `choice` and `tip` arrays in `questions.json` are counted
- **THEN** the `choice` array contains roughly 65 questions and the `tip` array contains roughly 35
  questions (a total of about 100), keeping the ratio approximately 2:1

### Requirement: Category variety
The question bank SHALL span a broad variety of general-trivia categories — including but not
limited to science, history, geography, nature, pop culture, sports, and technology — rather than
concentrating on one topic, and SHALL NOT reference specific game map regions or territories.

#### Scenario: Multiple categories represented
- **WHEN** the question ids and content in `questions.json` are reviewed
- **THEN** questions from at least six distinct general-trivia categories are present, and no
  question's correctness depends on the game's conquest map layout

### Requirement: Bilingual completeness
Every question in the bank SHALL have complete, natural (non machine-garbled) English and Russian
text, and choice questions SHALL have equal-length, natural English and Russian option lists.

#### Scenario: Every question has both languages
- **WHEN** any question in `choice` or `tip` is inspected
- **THEN** its `text` and `textRu` fields are both non-empty natural-language sentences, and for
  choice questions, `options` and `optionsRu` have the same number of entries with a natural
  Russian translation for each English option

### Requirement: Estimable numeric questions
Tip/numeric questions SHALL be based on facts that are genuinely estimable (e.g. counts, dates,
measurements, distances, weights, populations, historical years) rather than arbitrary lookup facts
with no reasonable basis for a guess, so that the "closest guess wins" mechanic remains meaningful.

#### Scenario: Numeric question is guessable
- **WHEN** a `tip` question is presented to a player with general world knowledge
- **THEN** the player can reason toward a plausible estimate of `correctNumericValue` rather than
  needing to have memorized the exact figure verbatim

### Requirement: Unique, factually correct, non-duplicate content
Every question SHALL have a unique `id` across the whole file, a single unambiguous correct answer,
and SHALL NOT duplicate or near-duplicate another question's subject matter. Choice questions SHALL
have plausible, non-trivial distractor options.

#### Scenario: No duplicate ids or subjects
- **WHEN** all 100+ questions are compared
- **THEN** every `id` value is unique across both `choice` and `tip` arrays, and no two questions
  ask about the same specific fact

#### Scenario: Distractors are plausible
- **WHEN** a choice question's incorrect options are reviewed
- **THEN** each distractor is a real, non-absurd value from the same category as the correct
  answer (not an obviously wrong filler option)
