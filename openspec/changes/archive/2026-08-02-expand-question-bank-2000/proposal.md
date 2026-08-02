## Why

The trivia question bank has 100 questions (65 choice / 35 tip). At that size, repeats become
noticeable within a handful of games, and there's no `category`/`difficulty` metadata to organize
growth — categorization today is just an informal `id` prefix convention. To scale the bank toward
2000 questions (enough that repeats stay rare across long play sessions), the schema, file layout,
and tooling need to support that scale first. This proposal covers that foundation — schema fields,
a per-category file split, loader validation, and a dedup tool — not the ~1900 new questions
themselves, which are authored in follow-up sessions once this lands.

## What Changes

- Add `category` (string) and `difficulty` (`"easy"|"medium"|"hard"`) fields to every question
  entry, both choice and tip kinds. One shared 13-category taxonomy for choice, with tip
  restricted to an 8-category subset of genuinely estimable-numeric categories.
- **BREAKING** (internal only, no wire-contract impact): replace the single
  `Data/questions/questions.json` file with one file per category under `Data/questions/choice/`
  and `Data/questions/tip/` (21 files total). The existing 100 questions are redistributed and
  backfilled with `category`/`difficulty` as part of this change.
- Update `QuestionRepository`'s loader to enumerate both subdirectories instead of one hardcoded
  path, and add two new fail-fast startup validations: `category` must be a known value for that
  question kind and must match the filename it was loaded from; `difficulty` must be one of the
  three known values.
- Add a new standalone tool, `tools/question-authoring/find-duplicates.mjs`, that flags
  near-duplicate question subject matter (token-overlap heuristic) across the whole bank —
  advisory, run manually before merging each future content batch.
- Rewrite `question-bank` spec numbers for the 2000-question target (counts, ratio, category
  coverage, difficulty labeling, content sharding).
- Explicitly defer category-aware draw balancing in `QuestionDealer` to future work — scaling the
  bank 20x already makes category clustering rare without touching the dealer.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `question-bank`: minimum question count rises from 100 to 2000, ratio and category-coverage
  requirements are restated at the new scale, and new requirements are added for `difficulty`
  labeling and per-category file sharding with startup validation.

## Impact

- `src/Triviador.Infrastructure/Content/QuestionRepository.cs` — loader rewritten to enumerate
  per-category files and validate the two new fields.
- `src/UI/Triviador.Web/Data/questions/questions.json` — deleted, replaced by
  `Data/questions/choice/*.json` and `Data/questions/tip/*.json` (21 files).
- `src/UI/Triviador.Web/Triviador.Web.csproj` — verify (smoke test) its existing recursive
  `Data\**` content glob picks up the new subfolders; no edit expected but must be confirmed.
- `tools/question-authoring/find-duplicates.mjs` — new file.
- `openspec/specs/question-bank/spec.md` — rewritten requirement numbers and two new requirements.
- No change to `Triviador.Domain`, `IQuestionRepository`/`IQuestionSource`/`QuestionDealer`
  interfaces, or any client-facing DTO/contract — category/difficulty are Infrastructure-internal
  metadata only.
- Content authoring for the ~1900 net-new questions is explicitly out of this change's apply scope
  — tracked as a Phase 2 backlog in `tasks.md`, executed across future sessions.
