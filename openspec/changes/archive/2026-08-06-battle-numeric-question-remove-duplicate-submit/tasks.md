## 1. Remove the duplicate numeric-question submit button

- [x] 1.1 In `src/Triviador.Client/src/components/QuestionCard.tsx`, remove the inline
      `<button className="primary" onClick={submitNumeric}>` from `.numeric-input-row`, leaving
      just the input and its optional unit label.
- [x] 1.2 Confirm `NumericKeypad`'s full-width submit button and the input's existing `Enter`-key
      handler remain the only ways to submit a numeric answer (no functional change).

## 2. Verification

- [x] 2.1 `cd src/Triviador.Client && npx tsc -b --noEmit` passes.
- [x] 2.2 `dotnet build` passes (verified via a non-conflicting `-o` output path since the local dev
      server holds a file lock on the default `bin/` output - unrelated to this change).
- [x] 2.3 `npm test` in `tests/e2e`: 16/16 passing (the suite's own locale-pin fix from the prior
      iteration keeps this a real signal now).
- [x] 2.4 Live Playwright check on iPhone 16 (393px): reached a Land Grab numeric question,
      confirmed `.numeric-input-row` now renders zero `<button>` elements, and confirmed submitting
      via the keypad's own submit button still resolves the question normally.
- [x] 2.5 Live Playwright check on Battle's numeric question (iPhone 16): confirmed the dock's
      scrollable-fallback measurements (`dockScrollHeight` vs `dockClientHeight` on `.shell-dock`)
      before/after the change; the removed row recovers real height on every numeric question,
      Land Grab and Battle alike. Battle can still exceed `70dvh` in the worst case (long prompt +
      long headline) and correctly falls back to the dock's existing internal scroll - this fix
      reduces frequency, not a guarantee, and that's flagged in the proposal for a possible
      follow-up.
- [x] 2.6 Screenshot of the post-change Land Grab numeric card confirms clean spacing with no
      leftover gap from the removed button.
