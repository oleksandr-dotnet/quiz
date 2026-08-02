## 1. Schema and taxonomy

- [x] 1.1 Finalize the 13 choice categories and 8 tip categories as fixed constants (this is the
      taxonomy lock-in point — do not change once Phase 2 batches begin)
- [x] 1.2 Add `category` (string) and `difficulty` (`"easy"|"medium"|"hard"`) fields to the choice
      and tip JSON schema (documented shape, no code yet)

## 2. File split and content migration

- [x] 2.1 Create `src/UI/Triviador.Web/Data/questions/choice/<category>.json` for all 13 choice
      categories and `src/UI/Triviador.Web/Data/questions/tip/<category>.json` for all 8 tip
      categories (empty arrays initially)
- [x] 2.2 Redistribute the existing 65 choice questions into their matching category files,
      backfilling `category` (from the old id prefix) and a reasonable `difficulty` per question
- [x] 2.3 Redistribute the existing 35 tip questions into their matching category files (re-tagging
      the single `num-` prefix bucket into the 8 tip categories), backfilling `category` and
      `difficulty`
- [x] 2.4 Delete `src/UI/Triviador.Web/Data/questions/questions.json`

## 3. Loader changes

- [x] 3.1 Update `QuestionRepository`'s constructor to enumerate `Data/questions/choice/*.json` and
      `Data/questions/tip/*.json` instead of reading one hardcoded file
- [x] 3.2 Add fixed `HashSet<string>` constants for the 13 choice / 8 tip canonical categories
- [x] 3.3 Add fail-fast validation: `category` must be a known value for that question's kind, and
      must equal the filename (without extension) it was loaded from
- [x] 3.4 Add fail-fast validation: `difficulty` must be one of `easy`/`medium`/`hard`
- [x] 3.5 Confirm existing validations (duplicate id across all files combined, non-empty bilingual
      text, option-array length/index bounds) still run correctly across the multi-file load

## 4. Tooling

- [x] 4.1 Create `tools/question-authoring/find-duplicates.mjs` (dependency-free Node, matching
      `tools/mapgen/generate-map.mjs`'s house style): normalize text into token sets, compute
      Jaccard similarity across all pairs globally (cross-kind included), print pairs above a
      `--threshold` flag (default 0.5)
- [x] 4.2 Run the script against the redistributed 100 questions as a smoke test (expect no
      unexpected high-similarity pairs, since content didn't change, only file location)

## 5. Build/startup verification

- [x] 5.1 `dotnet build` succeeds
- [x] 5.2 `dotnet publish` and confirm the new nested `Data/questions/choice/` and
      `Data/questions/tip/` files appear in the publish output (verifies the existing csproj
      `Data\**` glob picks up new subfolders without an edit)
- [x] 5.3 Run the Web host and confirm it starts cleanly with the redistributed 100 questions
- [x] 5.4 Deliberately break one entry (wrong `category` for its file) locally, confirm the host
      crashes at startup with a clear validation error, then revert
- [x] 5.5 Deliberately break one entry (invalid `difficulty` value) locally, confirm the same, then
      revert

## 6. Spec rewrite

- [x] 6.1 Confirm `specs/question-bank/spec.md` delta in this change matches the final taxonomy
      and file layout decided in tasks 1.1-1.2

## 7. Phase 2 — content authoring backlog (future follow-up sessions, NOT part of this apply)

- [x] 7.0 (2026-08-02, deviation from the original batch plan below) Before tackling geography/
      history — already reasonably covered at 12/14 questions each — prioritized the **six choice
      categories that had zero questions**: `arts-literature`, `mythology-religion`, `food-drink`,
      `language-wordplay`, `space-astronomy`, `economy-business` (12 each, 72 total), plus the one
      empty tip category, `economy-business` (10 questions). Every fact used is long-established
      and non-time-sensitive (historical dates, mythology, classic literature/art, physical
      constants) specifically to avoid authoring something that reads as correct today but goes
      stale (population figures, current-holder records, membership counts). Ran
      `find-duplicates.mjs` after authoring: found and fixed 3 genuine near/exact duplicates
      against existing questions (Mona Lisa vs. an existing pop-culture question, Red Planet and
      orbital-gravity vs. existing science questions) by swapping in different facts; remaining
      flagged pairs (e.g. "closest"/"second-closest" planet, wine/cider both being fruit-fermented)
      are same-subject-different-fact pairs, consistent with several already-accepted pairs
      elsewhere in the bank (e.g. `geo-0006`/`geo-0007`, smallest vs. largest country). All 182
      questions (bank grew from 100 to 182) validated against the exact rules
      `QuestionRepository`'s constructor enforces (known+matching category, valid difficulty,
      globally unique id, non-empty bilingual text, distinct options, options-length match,
      in-range `correctOptionIndex`) via a mirrored Node script, since a live host restart wasn't
      done this session (see verification section 8 below).
- [ ] 7.1 Batch 1 (choice): geography + history, ~200 new questions
- [ ] 7.2 Batch 2 (choice): science + nature, ~200 new questions
- [ ] 7.3 Batch 3 (choice): sports + pop-culture, ~200 new questions
- [ ] 7.4 Batch 4 (choice): technology + arts-literature, ~195 new questions
- [ ] 7.5 Batch 5 (choice): mythology-religion + space-astronomy, ~186 new questions
- [ ] 7.6 Batch 6 (choice): food-drink + economy-business, ~186 new questions
- [ ] 7.7 Batch 7 (choice): language-wordplay standalone, ~93 new questions
- [ ] 7.8 Batch 8 (tip): geography + history, ~168 new questions
- [ ] 7.9 Batch 9 (tip): science + nature, ~168 new questions
- [ ] 7.10 Batch 10 (tip): sports + pop-culture, ~168 new questions
- [ ] 7.11 Batch 11 (tip): technology + economy-business, ~168 new questions
- [ ] 7.12 Each batch: run `find-duplicates.mjs` before merging; author English and Russian text
      together per question, not translated separately later

## 8. Final verification (after Phase 2 completes, future session)

- [ ] 8.1 Confirm total question count is at least 2000
- [ ] 8.2 Confirm choice:tip ratio is approximately 2:1
- [ ] 8.3 Confirm at least 12 of 13 choice categories and at least 6 of 8 tip categories are
      represented
- [ ] 8.4 Confirm every category has at least one question of each difficulty level
- [ ] 8.5 Archive this change
