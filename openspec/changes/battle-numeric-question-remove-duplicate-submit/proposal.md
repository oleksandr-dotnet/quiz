## Why

Live Playwright audit across all three target devices (iPhone 16 at 393px, iPhone 17 at 402px,
OnePlus 13R at ~421px) walked the full golden path through Land Grab, Reveal, and Battle for the
first time (prior iterations only reached Base Selection). On the **Battle** screen, a `Tip`
(numeric) question's dock content (`battle-headline` turn banner + `question-card-header` + numeric
input row + full keypad + submit button) exceeded `.shell-dock`'s `max-height: 70dvh` and required
scrolling within the dock to reach the keypad's bottom row and submit button - confirmed via
`getBoundingClientRect()` (`dockScrollHeight` 608-663px vs `dockClientHeight` 461px on iPhone 16).
This is the sanctioned fallback per the `mobile-viewport-interaction` spec ("dock SHALL become
internally scrollable rather than clipping"), and it does work - but Land Grab's equivalent numeric
question never needs it, because Battle carries one extra element Land Grab doesn't: a
`battle-headline` turn banner.

Investigating why the numeric dock is that tall found a genuine redundancy, not just a tight
budget: `QuestionCard`'s numeric branch rendered **two submit buttons** for the exact same action -
an inline "Отправить" next to the input (`.numeric-input-row button`), and a second, separate
full-width "Отправить" below `NumericKeypad`'s own grid (`.numeric-keypad-submit`). Both call the
same `submitNumeric()`. This wastes a full row of height in exactly the layout (Battle, numeric,
narrow viewport) that's tightest, and is redundant UI regardless of viewport size - a real player
has no reason to see the same action offered twice, stacked vertically.

## What Changes

- Remove the inline submit button from `.numeric-input-row` in `QuestionCard.tsx` (`src/Triviador.Client/src/components/QuestionCard.tsx`).
  The row now holds just the numeric `<input>` and its optional unit label. `NumericKeypad`'s own
  full-width submit button (and the existing `Enter`-key handler on the input) remain the sole way
  to submit a numeric answer - no functionality lost, one redundant control removed.
- No change to `NumericKeypad.tsx`, CSS, or any Domain/Application code - this is a single JSX
  removal in the shared `QuestionCard` component, so it applies identically to both Land Grab and
  Battle's numeric questions.

## Capabilities

### Modified Capabilities
- `mobile-viewport-interaction`: no requirement text change - this reduces how often the existing
  "dock becomes internally scrollable" fallback is needed for Battle's numeric questions, by
  removing genuinely redundant UI rather than by shrinking anything to make room.

## Impact

- `src/Triviador.Client/src/components/QuestionCard.tsx` only.

## Known issue found but out of scope for this change

Battle's numeric-question dock can still exceed `70dvh` and require internal dock scrolling in the
worst case (a long question prompt combined with a long attacker/defender/region name in the
headline) - this fix reduces the frequency/severity but the existing scrollable-dock fallback is
still the backstop, exactly as the `mobile-viewport-interaction` spec already sanctions. A future
iteration could look at trimming `.battle-headline` further (e.g. truncating very long territory
names) if this still shows up often in practice.
