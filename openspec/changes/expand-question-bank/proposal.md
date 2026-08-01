## Why

The question bank at `src/UI/Triviador.Web/Data/questions/questions.json` currently has only 23
questions (15 choice + 8 tip/numeric). With that few questions, a single multi-round game session
will repeat questions, which is noticeable and undermines the trivia-conquest experience. The
schema and loader (`QuestionRepository`) already support an arbitrary number of questions in both
categories — this is a pure content expansion, no code changes needed.

## What Changes

- Expand `questions.json` from 23 to 100 questions total, roughly maintaining the existing ~2:1
  choice:tip ratio (~65 choice + ~35 tip/numeric).
- Add broad variety across general-trivia categories: science, history, geography, nature, pop
  culture, sports, technology, and similar — general world facts, not tied to any specific map
  region (the map is being reworked into an abstract shapes map in a parallel track).
- For tip/numeric questions, favor genuinely estimable facts (counts, dates, measurements,
  distances, weights, populations, historical years) so the "closest guess" mechanic stays
  meaningful, rather than pure unguessable lookup trivia.
- Every new question gets both English and Russian text (and options/unit where applicable),
  matching the existing bilingual schema exactly — no new locale fields.
- No changes to `QuestionRepository.cs`, DTOs, or any other code — the file already satisfies the
  existing fail-fast startup validation (unique ids, matching options/optionsRu lengths,
  correctOptionIndex in range, non-empty EN+RU text).

## Capabilities

### New Capabilities
- `question-bank`: The content contract for the trivia question bank JSON file — composition
  (category variety, choice/tip ratio, minimum count), bilingual completeness, and the estimability
  requirement for numeric questions.

### Modified Capabilities
(none — no existing spec's requirements change; this introduces a new capability describing the
content data itself)

## Impact

- Affected file: `src/UI/Triviador.Web/Data/questions/questions.json` only.
- No changes to `Triviador.Domain`, `Triviador.Application`, `Triviador.Infrastructure` code, or
  any TypeScript/client code.
- Verified via existing startup validation in `QuestionRepository` (run `dotnet build` /
  start the Web project) and manual review of the JSON.
