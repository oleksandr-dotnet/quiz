## 1. Draft new questions

- [x] 1.1 Draft ~50 new `choice` questions across science, history, geography, nature, pop culture,
      sports, and technology, each with English + Russian text, 4 plausible options in both
      languages, and a correct index, using a new id prefix per category as needed.
- [x] 1.2 Draft ~27 new `tip` (numeric) questions favoring genuinely estimable facts (counts,
      dates, measurements, distances, weights, populations, historical years), each with English +
      Russian text and matching unit/unitRu (or null/null when unitless).

## 2. Assemble the question bank

- [x] 2.1 Merge the new questions into `src/UI/Triviador.Web/Data/questions/questions.json`
      alongside the existing 15 choice + 8 tip questions, reaching ~65 choice + ~35 tip = ~100
      total.
- [x] 2.2 Verify every `id` is unique across both arrays combined.
- [x] 2.3 Verify every choice question's `options`/`optionsRu` arrays are equal length and
      `correctOptionIndex` is within range.
- [x] 2.4 Verify every question (choice and tip) has non-empty, natural `text` and `textRu`.
- [x] 2.5 Scan for duplicate/near-duplicate subject matter across all questions.

## 3. Validate

- [x] 3.1 Run `dotnet build` from the repo root to confirm `QuestionRepository`'s fail-fast startup
      validation accepts the updated JSON.
- [x] 3.2 Report final counts (choice vs. tip vs. total) and the list of categories covered.
