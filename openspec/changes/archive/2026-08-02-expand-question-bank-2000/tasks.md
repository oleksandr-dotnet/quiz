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
- [x] 7.0b (2026-08-02, same session) Topped up the remaining thin categories so every choice
      category has 11-12 questions and every tip category has 5-14 (previously several tip
      categories had just 1): +6 choice/technology, +4 choice/sports, +4 choice/nature, +3
      choice/pop-culture, +5 tip/nature, +4 tip/sports, +5 tip/technology, +4 tip/pop-culture, +3
      tip/history (38 more questions, bank now at 220). Same fact-stability discipline as 7.0. The
      dedup pass this round caught 3 genuine duplicates before commit (a tip/history question
      re-asking an existing choice/history fact twice, and a tip/nature bones question duplicating
      an existing tip/science one) plus 1 during the empty-category pass (a language-wordplay
      question duplicating an existing pop-culture one) - all swapped for distinct fresh facts
      rather than left in or simply deleted.
- [x] 7.0c (2026-08-02, same session) Third top-up round: +2 (science, history choice to 12 each),
      then +8 geography, +7 science, +6 nature, +5 sports, +6 technology, +6 pop-culture (all
      choice). Bank now at 260 questions. Same discipline throughout: `find-duplicates.mjs` after
      each file edit, one genuine duplicate caught and fixed (a new boiling-point-of-water science
      question restating an existing tip/science fact exactly - swapped for freezing point
      instead).
- [x] 7.0d (2026-08-02, same session) Evened out the tip categories too: +4 nature, +5 sports, +3
      pop-culture, +4 technology, +2 history (18 more, bank now at 278). Every tip category now
      sits at 8-14. Same discipline; zero new duplicates this round.
- [x] 7.1 Batch 1 (choice): geography + history, 200 new questions (2026-08-02, delegated to two
      parallel subagents, one file each). geography 20->120, history 12->112. `find-duplicates.mjs`
      at `--threshold 0.85` caught 3 genuine exact-duplicate pairs after this batch (Mona Lisa
      re-asked from history after already existing in pop-culture; Columbus 1492 re-asked as choice
      after already existing as a tip numeric fact; UN founding year same story) - all 3 fixed by
      swapping in different facts, not deleted. Below-0.85 pairs (e.g. "which river flows through
      <city>" repeated per city) are intentional same-template/different-subject pairs, consistent
      with precedent (geo-0006/geo-0007).
- [x] 7.2 Batch 2 (choice): science + nature, 200 new questions (same session/method). science
      19->119, nature 18->118. Dedup caught 3 more exact duplicates in science.json (heart chambers
      vs. an existing tip fact, closest-planet and home-galaxy vs. existing space-astronomy facts) -
      fixed; the first two replacement attempts themselves collided with other existing science.json
      entries (blood-type-universal-donor and hardest-substance were already present at sci-0010/
      sci-0011), caught by a second dedup pass and fixed again with genuinely fresh facts
      (transpiration, most-abundant-element-by-mass) - worth remembering that a duplicate's *fix*
      needs its own fresh-fact check against the whole bank, not just against the pair that was
      flagged.
- [x] 7.3 Batch 3 (choice): sports + pop-culture, 200 new questions. sports 17->117, pop-culture
      18->118. Zero duplicates found this round.
- [x] 7.4 Batch 4 (choice): technology + arts-literature, 195 new questions. technology 18->116,
      arts-literature 12->109. Zero duplicates found.
- [x] 7.5 Batch 5 (choice): mythology-religion + space-astronomy, 186 new questions.
      mythology-religion 12->105, space-astronomy 12->105. Religious content kept neutral/factual
      (texts, figures, places, historical practices) across many traditions, not concentrated on one.
      Zero duplicates found.
- [x] 7.6 Batch 6 (choice): food-drink + economy-business, 186 new questions. food-drink 12->105,
      economy-business 12->105. Currency/company/market facts anchored to historical founding
      years, not current rankings/valuations. Zero duplicates found.
- [x] 7.7 Batch 7 (choice): language-wordplay standalone, 93 new questions. 12->105. Given this
      category's translation risk (English-specific puns don't survive translation), favored
      etymology/idiom-origin/language-family/writing-system facts that ask the same underlying fact
      in both languages rather than reproducing wordplay in Russian. Zero duplicates found.

      All 7 choice batches (1260 new questions) complete: choice bank grew from 194 to 1454
      entries. Every batch validated via `node -e "JSON.parse(...)"` plus a structural check
      (correctOptionIndex always 0, exactly 4 distinct options per language, category matches
      filename, difficulty spread ~30/40/30) before being counted done, and `find-duplicates.mjs
      --threshold 0.85` was run after every batch (not just once at the end) so a duplicate from
      batch N couldn't compound into batch N+1's authoring context.
- [x] 7.8 Batch 8 (tip): geography + history, 168 new questions (2026-08-02). tip/geography
      14->98, tip/history 10->94. The `num-` id counter is global across all tip files, not
      per-category like choice - each batch's two agents were pre-assigned disjoint id ranges
      (computed from the running global max before dispatch) so two parallel agents writing
      different files could never collide. Dedup caught 1 exact duplicate (Wall Street Crash year
      re-asked in tip/history after already existing in tip/economy-business) - fixed; the first
      fix attempt (Chernobyl year) itself collided with another new entry in the same batch, fixed
      again with a genuinely fresh fact (Domesday Book) - same "a fix needs its own dedup pass"
      lesson as 7.2, now clearly a recurring pattern worth remembering for any future batches.
- [x] 7.9 Batch 9 (tip): science + nature, 168 new questions. tip/science 10->94, tip/nature
      10->94. Dedup caught 1 exact duplicate (heart-chamber count re-asked in tip/science after
      already existing in tip/nature) - fixed with a fresh fact (rib-pair count).
- [x] 7.10 Batch 10 (tip): sports + pop-culture, 168 new questions. tip/sports 10->94,
      tip/pop-culture 10->94. Zero duplicates found this round.
- [x] 7.11 Batch 11 (tip): technology + economy-business, 168 new questions. tip/technology
      10->94, tip/economy-business 10->94. Dedup caught 2 exact duplicates (Treaty of Rome year
      re-asked in tip/economy-business after already existing in tip/history from batch 7.8; NES
      US-release year re-asked in tip/technology after already existing in tip/pop-culture from
      batch 7.10) - both fixed with fresh facts (UK currency decimalization year; Sony Walkman
      release year).
- [x] 7.12 Ran `find-duplicates.mjs --threshold 0.85` after every batch (not just at the end),
      catching 9 genuine exact-duplicate pairs total across all of Phase 2 (batches 7.1-7.11) -
      every one fixed by swapping in a different fact, none simply deleted. English and Russian
      text were authored together per question throughout, not machine-translated separately.

      All 4 tip batches (672 new questions) complete: tip bank grew from 84 to 756 entries.
      Phase 2 grand total: 1260 new choice + 672 new tip = 1932 new questions, bank grew from 278
      to **2210** entries (1454 choice + 756 tip).

## 8. Final verification (after Phase 2 completes, future session)

- [x] 8.1 Confirm total question count is at least 2000 — **2210**, confirmed via a Node script
      loading every `Data/questions/{choice,tip}/*.json` file.
- [x] 8.2 Confirm choice:tip ratio is approximately 2:1 — **1454:756 ≈ 1.92:1**, confirmed.
- [x] 8.3 Confirm at least 12 of 13 choice categories and at least 6 of 8 tip categories are
      represented — **13/13 choice and 8/8 tip**, confirmed (every category has 94-120 entries).
- [x] 8.4 Confirm every category has at least one question of each difficulty level — confirmed
      via a per-category/per-difficulty tally script; every one of the 21 category files has at
      least one `easy`, one `medium`, and one `hard` entry.

      **Two real bugs found and fixed during this final pass, beyond the batch-level dedup already
      covered in section 7:**

      1. **`correctNumericValue` type mismatch (data bug).** `TipQuestionJson.CorrectNumericValue`
         is a C# `long` (see `QuestionRepository.cs`), but nothing in the authoring instructions for
         batches 7.9-7.11 said values must be integers, and several subagents wrote natural
         decimal facts (ocean areas in "X.Y million km²", animal weights in "X.Y kg", sports
         measurements in "X.YZ m", etc.) - 39 entries across `tip/geography.json`,
         `tip/nature.json`, `tip/science.json`, `tip/sports.json`, and `tip/technology.json`. Since
         `System.Text.Json` throws on deserializing a fractional JSON number into a `long`, every
         one of these would have crashed `QuestionRepository`'s constructor - i.e. the whole host -
         at startup. Fixed by rescaling the unit on each entry so the value becomes a clean integer
         (e.g. "million km²" -> "thousand km²", "kg" -> "g", "m" -> "cm"/"mm", "s" -> "ms"), keeping
         both `text`/`textRu` and `unit`/`unitRu` consistent with the new scale; one fact (blood pH,
         inherently a non-integer measurement that can't be rescaled) was replaced outright with a
         different fixed fact (skull bone count). Caught by grepping for
         `"correctNumericValue":\s*-?[0-9]+\.[0-9]+` across `tip/*.json` and cross-checked against
         `QuestionRepository.cs`'s actual record definitions rather than assumed from the JSON
         alone - worth remembering that mirrored-schema Node validation (used throughout section 7)
         only catches what it's told to check, not the real C# type.
      2. **Missing per-draw option shuffle (pre-existing production bug, unrelated to this
         change's content but exposed by it).** Every single question in the bank - old and new -
         stores the correct answer at a fixed convention index (`correctOptionIndex: 0`, i.e.
         always first), by design (see section 1-2 of this file and the design doc). Nothing in
         `QuestionDealer.Draw` shuffled the options before serving a question, so in the running
         game a choice question's correct answer was always presented in the same position -
         trivially exploitable. Fixed in `Triviador.Infrastructure/Content/QuestionDealer.cs`
         (`ShuffleOptions`, called from `Draw` for `QuestionKind.Choice`): performs a per-draw
         Fisher-Yates shuffle of `Prompt.Options`/`OptionsRu` and remaps `CorrectOptionIndex`
         accordingly, using the dealer's already-seeded `_random` (so it stays reproducible from
         `(seed, command log)` per the domain's replay invariant). This was almost certainly latent
         since M5 (Battle/land-grab shipped answer-ranking before this session ever touched
         content) - it surfaced now because authoring ~2000 more `correctOptionIndex: 0` entries is
         what made a subagent actually trace how an option's display position gets decided.
      3. A related process mistake made and corrected in this same pass: an attempted fix to
         `tip/geography.json`'s decimal values was applied twice by mistake (multiplying by 1000
         twice), and the recovery attempt used `git checkout --` on that single file - which,
         since nothing this session had been committed, reverted the file all the way back to
         its pre-batch-7.8 state (14 entries), silently discarding the 84 questions batch 7.8 had
         just authored for it. Recovered by re-running batch 7.8's geography half from scratch (a
         fresh subagent, this time briefed up front on the integer-only constraint above) rather
         than by any git-history recovery, since nothing had been committed. Worth remembering:
         `git checkout -- <file>` restores to the last *commit*, not to "a moment ago" - with an
         uncommitted multi-hour session, that can be a much bigger revert than intended.

- [x] 8.5 Archive this change
