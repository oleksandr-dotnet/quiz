## 1. Reclaim dock height for AnswerRoster

- [x] 1.1 In `src/Triviador.Client/src/App.css` mobile breakpoint, trim `.option-plate` padding to
      `0.6em 0.9em` (from `0.85em 1.1em`), keeping the existing `min-height: 44px` floor.
- [x] 1.2 Trim `.choice-options` gap to `0.4rem` (from `0.6rem`) in the same breakpoint.
- [x] 1.3 Trim `.answer-roster-wrap` gap to `0.3rem` (from `0.45rem`) for extra margin.

## 2. Fix unrelated pre-existing e2e regression found via the verification gate

- [x] 2.1 `tests/e2e/specs/kick-player.spec.ts`: update `answerQuestionIfAsked` to click
      `data-testid="keypad-submit"` instead of the now-removed `.numeric-input-row button.primary`.
      Confirmed via `git stash` this failure predates this change.

## 3. Verification

- [x] 3.1 `cd src/Triviador.Client && npx tsc -b --noEmit` passes.
- [x] 3.2 `dotnet build` passes (alternate `-o` path; default `bin/` is locked by the running dev
      server).
- [x] 3.3 `npm test` in `tests/e2e`: 16/16 passing (was 15/16 before the kick-player.spec.ts fix,
      confirmed pre-existing via `git stash`).
- [x] 3.4 Live measurement via `getBoundingClientRect()` on iPhone 16 (393×659): before this change,
      `.answer-roster-wrap` rendered fully below the viewport (`top` 607-700px against
      `innerHeight` 659px) across multiple sampled questions. After: a typical question now measures
      `dockScrollHeight` 463px vs `dockClientHeight` 461px (roster fully visible); longer sampled
      questions still exceed budget by 60-90px (down from 460-550px+) and correctly fall back to the
      dock's existing internal scroll.
- [x] 3.5 Re-ran the 3-device screenshot audit (iPhone 16, iPhone 17, OnePlus 13R) for Land Grab
      question + reveal: no new horizontal or document-level overflow, `.option-plate` tap targets
      still measured >=44px (59px minimum sampled) on all three.
