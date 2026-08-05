## Context

`QuestionCard`'s numeric (`Tip`) branch renders a `.numeric-input-row` (input + unit + an inline
submit button) followed by `NumericKeypad`, which renders its own digit grid plus a second,
full-width submit button. Both buttons call the same `submitNumeric()` handler. On Land Grab this
extra row goes unnoticed because the dock has headroom; on Battle, `BattleDock` also renders a
`battle-headline` turn banner above the question card that Land Grab's dock never has, and the
combined height pushes past `.shell-dock`'s `70dvh` cap on the three real target device sizes,
falling back to the dock's internal scroll.

## Decision

Delete the inline submit button from `.numeric-input-row`, keeping only the input and its unit
label there. `NumericKeypad`'s full-width submit (and the input's existing `Enter`-key handler)
remain the only ways to submit - so no capability is lost, and every numeric question everywhere
(Land Grab and Battle alike) gets back one full row of vertical space.

### Alternatives considered
- **Shrink the keypad keys or reduce gaps to reclaim space instead**: keys are already close to the
  44x44 CSS px minimum touch-target size the `mobile-viewport-interaction` spec requires (measured
  ~58px at the current `max-width: 11.5rem`); shrinking further risks violating that requirement for
  a cosmetic width saving, and doesn't remove the actual redundancy.
- **Shrink or truncate `.battle-headline` instead**: treats the symptom (Battle-only extra height)
  rather than the cause (a duplicated control that exists on every numeric question, Battle or not);
  left as a follow-up if the scrollable-dock fallback still triggers often after this fix.
- **Add a visual "scroll for more" affordance to `.shell-dock` instead of removing anything**:
  papers over discoverability of the existing scroll fallback without addressing why the content is
  taller than it needs to be; the redundant button is a real bug independent of any viewport-fit
  question.

## Risks

- None identified for functionality - `Enter`-to-submit and the keypad's submit button already
  fully covered this action; the inline button was strictly additional, not a distinct capability.
- Visual: removing a row changes vertical rhythm slightly on Land Grab's numeric card too (not just
  Battle) - verified via live Playwright screenshot on iPhone 16 post-change, layout reads cleanly
  with no leftover gap.
