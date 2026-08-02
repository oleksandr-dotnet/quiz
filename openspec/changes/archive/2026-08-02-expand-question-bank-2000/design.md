## Context

The question bank is a single JSON file, `Data/questions/questions.json`, with two arrays
(`choice`, `tip`), loaded once at host startup by `QuestionRepository` into immutable in-memory
arrays and drawn from by `QuestionDealer` (a per-room seeded shuffle bag, balanced only by
`QuestionKind`). There is no `category`/`difficulty` field today — categorization is an informal
`id` prefix convention (`geo-`, `hist-`, `sci-`, `nat-`, `sport-`, `cult-`, `tech-` for choice; a
single undifferentiated `num-` prefix for all 35 tip questions). At 100 questions this was
workable; at a 2000-question target it isn't — there's no way to guarantee category coverage, no
difficulty concept at all, and a single 40k+ line JSON file becomes an unmanageable unit for
batch authoring and review. This design covers the schema, file layout, and loader/tooling changes
needed to make 2000-scale authoring tractable. It does not cover the ~1900 new questions
themselves — that's a follow-up, multi-session content-authoring effort (tracked in `tasks.md`).

## Goals / Non-Goals

**Goals:**
- Add `category`/`difficulty` metadata so the bank can grow to 2000 questions with verifiable
  category coverage and difficulty labeling.
- Split one monolithic file into per-category files so batches can be authored and reviewed
  independently without merge conflicts on one giant array.
- Keep every fail-fast validation at least as strict as today's, and add validation that catches
  the new authoring-mistake classes (wrong category, filename/category mismatch, bad difficulty).
- Provide a lightweight, advisory dedup tool proportional to this being a solo hobby project with
  no CI infrastructure for anything heavier.

**Non-Goals:**
- Authoring the ~1900 new questions themselves (Phase 2, out of this change's apply scope).
- Any change to `Triviador.Domain`, `IQuestionRepository`/`IQuestionSource`, the wire contract, or
  the client — category/difficulty are Infrastructure-internal metadata only.
- Category-aware draw balancing in `QuestionDealer` — explicitly deferred (see Decisions).
- Automated (ML/embedding-based) duplicate detection — a token-overlap heuristic is enough at this
  scale and this project's tooling budget.

## Decisions

### One shared category taxonomy across choice and tip, not two independent ones
A single 13-category list for choice, with tip using a fixed 8-category *subset* restricted to
categories that produce genuinely estimable numeric facts (mythology, arts, space, food, and
language don't naturally produce "guess the number" questions). Considered: fully independent
taxonomies per kind — rejected because it doubles the bookkeeping surface (two enums to keep in
sync everywhere) for no real benefit, since the tip subset is just choice's categories minus five.

### Category and difficulty stay Infrastructure-internal, not threaded onto Domain/wire types
`Question`/`QuestionPrompt` in `Triviador.Domain` and the client's `contracts.ts` gain no new
fields. Considered: adding `Category` to `QuestionPrompt` so the client could show it — rejected as
unnecessary scope; the client has no current use for it, and adding wire surface for a
does-nothing-yet field just adds risk (a leaked category field is a more attractive surface for a
future scope-creep discussion, not something to ship speculatively).

### Split into one file per category, not one file per kind, not one big file
Given 21 categories combined (13 choice + 8 tip) and a ~2000-question target, one file per category
keeps each file to roughly 90-130 questions — small enough to author, review, and dedup-check in a
single batch, while still being coarse enough that 21 files is a manageable directory listing.
Considered: keep one `choice.json`/`tip.json` pair — rejected, since a single ~1300-entry array is
exactly the merge-conflict/unreviewable-diff problem this design exists to avoid.

### Loader enumerates directories instead of reading one hardcoded path
`QuestionRepository`'s constructor changes from `File.ReadAllText(fixedPath)` to enumerating
`Data/questions/choice/*.json` and `Data/questions/tip/*.json`, deserializing each file
independently and accumulating into the same `ImmutableArray` builders as today. The
filename-must-equal-declared-category check is a cheap, high-value addition: it turns a
common copy-paste-into-the-wrong-file mistake into an immediate host-startup crash (consistent with
this repo's existing fail-fast philosophy) instead of a silently mis-categorized question that only
surfaces during a later spec-conformance review.

### Dedup tool is a standalone advisory script, not a build-time gate
`tools/question-authoring/find-duplicates.mjs` (dependency-free Node, matching
`tools/mapgen/generate-map.mjs`'s house style) computes Jaccard token-overlap similarity across
*all* question pairs globally (cross-kind, since a tip and choice question can share subject
matter) and prints candidates above a threshold for human judgment. It is not wired into `dotnet
build` or any CI, because there is no CI in this project and a heuristic dedup check has a real
false-positive/false-negative rate that shouldn't silently block a build. Final authority for
"is this actually a duplicate" stays with the human reviewing each authoring batch, matching how
the prior 23→100 expansion's dedup step worked.

### QuestionDealer category-aware balancing: deferred, not solved here
`QuestionDealer` currently balances only Choice-vs-Tip draws via two Fisher-Yates bags. Adding
category-aware balancing would mean either widening the wire-facing `Question`/`QuestionPrompt`
with a `Category` (unnecessary client-facing surface, see above) or maintaining ~21 internal
per-category sub-bags with their own exhaustion/reshuffle logic — real complexity in a codebase
with zero automated tests to protect it from regressions. Scaling the bank 20x already makes
category clustering statistically rare without any dealer change: with ~100-130 questions per
category instead of ~10-15, the chance of a short session repeatedly drawing from one category
drops sharply on its own. Recommendation: ship without dealer changes, revisit only if playtesting
after Phase 2 actually surfaces clumping complaints.

## Risks / Trade-offs

- **[Risk] 2000 handwritten, bilingual, non-duplicate questions cannot be authored in one sitting**
  → Mitigation: Phase 2 is explicitly an 11-batch backlog spanning many follow-up sessions, tracked
  in `tasks.md`; this change's apply scope is Phase 1 only (schema/tooling/spec, zero net-new
  content beyond backfilling the existing 100).
- **[Risk] Category taxonomy lock-in** — once Phase 2 batches start, the 13/8 category names are
  referenced by ~2000 JSON entries, the spec, and the dedup script — renaming one mid-authoring
  means a wide mechanical find-and-replace → Mitigation: finalize the taxonomy in this Phase 1
  change, before any Phase 2 batch begins.
- **[Risk] Dedup script false negatives** (conceptual duplicates phrased very differently) and
  false positives (legitimately similar questions in the same category) → Mitigation: advisory
  only; a human makes the final call per flagged pair, same as the prior expansion.
- **[Risk] No shared source of truth between the C# category `HashSet` constant and the Node
  script's own hardcoded category list** → Mitigation: accept as a manual-sync cost proportional to
  this project's scale; not worth building shared tooling for a two-consumer list.
- **[Risk] `Triviador.Web.csproj`'s existing recursive `Data\**` content glob might not actually
  pick up new nested subfolders** → Mitigation: Phase 1 includes an explicit `dotnet publish` smoke
  test before relying on it.

## Migration Plan

1. Add `category`/`difficulty` to the JSON schema and the two new loader validations.
2. Create the 21 category files under `Data/questions/choice/` and `Data/questions/tip/`,
   redistributing and backfilling the existing 100 questions with category/difficulty.
3. Delete `Data/questions/questions.json`.
4. Add `tools/question-authoring/find-duplicates.mjs`.
5. Smoke-test `dotnet publish` to confirm the csproj glob picks up the new files, and deliberately
   break one entry locally (wrong category, then bad difficulty) to confirm the host still crashes
   at startup as expected, then revert.
6. Rewrite `openspec/specs/question-bank/spec.md` to the new numbers/requirements.
7. Archive this change once Phase 1's tasks are all done — Phase 2 content batches happen in
   separate follow-up sessions/changes after this archives (see `tasks.md` for the backlog).

No rollback complexity beyond standard git revert — this is content/config, no persisted runtime
state or migration of live data involved.

## Open Questions

- None blocking Phase 1. Phase 2 pacing (how many of the 11 batches per session) is a scheduling
  question for future sessions, not a design question.
