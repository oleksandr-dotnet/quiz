## 1. Display constants

- [x] 1.1 Add `BASE_ASSAULT_UNLOCK_ROUND` and `MINIMUM_BASE_DISTANCE` to `lib/gameRules.ts`,
      mirroring `GameRules.BaseAssaultUnlockRound`/`GameRules.MinimumBaseDistance`, alongside the
      existing `BASE_HIT_POINTS_DEFAULT`/`BASE_ASSAULT_SCORE_BONUS` constants.

## 2. Modal content

- [x] 2.1 Restructure `HowToPlayModal.tsx`'s section list from the 4 original `PHASE_KEYS` to the 11
      sections in proposal order (objective, setup, categoryBan, baseSelection, landGrab,
      battleTurns, duels, baseAssault, streaks, goldenQuestion, scoring), supporting multi-paragraph
      sections (`baseAssault` needs two) and interpolating the new mirrored constants.
- [x] 2.2 Write the `howToPlay.*` English copy in `en.json` for all 11 sections.
- [x] 2.3 Write the `howToPlay.*` Russian copy in `ru.json` for all 11 sections, matching the
      existing modal's tone/register.

## 3. Spec and test alignment

- [x] 3.1 Update `client-onboarding`'s "The rules explainer summarizes every game phase" requirement
      (delta in this change's `specs/client-onboarding/spec.md`) to describe full mechanic coverage.
- [x] 3.2 Update `tests/e2e/specs/onboarding-localization.spec.ts`'s "opens from the landing screen"
      test: assert the new section count and spot-check headings across the new content instead of
      the old 4-heading/4-keyword assertion.

## 4. Verification

- [x] 4.1 `cd src/Triviador.Client; npx tsc -b --noEmit` passes.
- [x] 4.2 Run the updated `onboarding-localization.spec.ts` "How to play modal" tests against a
      running dev server and confirm they pass in both locales.
