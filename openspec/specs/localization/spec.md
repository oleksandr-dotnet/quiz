# localization Specification

## Purpose
Governs how a room's language selection propagates to trivia content and region names, and how a
room's language is chosen and fixed at creation.

## Requirements

### Requirement: Trivia question content carries both supported languages
Every question in the question bank SHALL carry both a Russian and an English rendering of its text
(and, for numeric questions, its unit), keyed by the same question id, so a room can be dealt questions
in either supported language from one content source.

#### Scenario: A question missing either language's text fails to load
- **WHEN** question content is loaded and a question entry has no Russian text or no English text
- **THEN** the host fails startup naming the question and the missing language

#### Scenario: A question is dealt in the room's language
- **WHEN** a question is asked in a room whose `GameState.Rules.Language` is Russian
- **THEN** the `QuestionPrompt` broadcast for that question carries the Russian text (and Russian unit,
  if numeric)

### Requirement: Region display names are locale-dependent
The name projected for a region to any viewer SHALL be chosen from that region's English or Russian
name according to the viewer's room's `GameState.Rules.Language`, never a single fixed string
independent of language.

#### Scenario: A region's projected name matches the room's language
- **WHEN** a region is projected to a viewer whose room's `Language` is English
- **THEN** the projected region name is that region's English name, not its Russian name

### Requirement: A room's language is selectable at creation with Russian as the default
Creating a room SHALL accept an optional language selection (Russian or English); when none is given,
the room's language SHALL default to Russian.

#### Scenario: Creating a room without specifying a language defaults to Russian
- **WHEN** a room is created with no language argument supplied
- **THEN** the created room's language is Russian

#### Scenario: Creating a room with an explicit language honors it
- **WHEN** a room is created with English explicitly selected
- **THEN** the created room's language is English
