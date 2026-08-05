## Why

Live Playwright audit of Land Grab across the three target devices (iPhone 16 at 393px, iPhone 17
at 402px, OnePlus 13R at ~421px, all portrait) found that `AnswerRoster` - the "X/4 answered" stamp
row shown below every question - rendered **entirely below the visible viewport** on a routine,
average-length `Choice` question, with no scroll affordance hinting it existed. Measured directly
via `getBoundingClientRect()` on iPhone 16 (393×659): `.answer-roster-wrap` at `top: 668-700px`,
`bottom: 700-730px`, against a `window.innerHeight` of 659px - not clipped by a few pixels, fully
off-screen.

Root cause was a budget problem, not a single bug: `.shell-dock`'s `max-height: 70dvh` (461px on
this viewport) is a hard cap, and `QuestionCard` alone (header + 4 stacked `.option-plate` buttons
at their full desktop-inherited padding) already consumed 392-421px of it, leaving only 40-70px for
`AnswerRoster`'s own ~61px - a deficit even before accounting for longer question/option text. A
contributing factor: the roster-name fix shipped earlier this session
(`mobile-roster-name-full-width-fix`) correctly fixed a 0px-name-collapse bug by giving `.shell-roster`
player cards a second line, but that added height has no map-shrinking budget to draw from during
Land Grab/Battle answering, since `.shell-map` is already collapsed to 0 in that exact state.

`.shell-dock` already has `overflow-y: auto` as the spec-sanctioned fallback for genuinely long
content, so this wasn't "unreachable" in the strictest sense - a touch-scroll within that one div
would reveal it. But with zero visual affordance that scrolling is possible (no scrollbar, no
fade/shadow cue) and the rest of the game explicitly never scrolling, a real player has no reason to
suspect scrolling *this specific box* would help, making an entire "who's answered" indicator
effectively invisible on the common case, not just an edge case.

## What Changes

- Trim `.option-plate` vertical padding (`0.85em 1.1em` → `0.6em 0.9em`) and `.choice-options` gap
  (`0.6rem` → `0.4rem`) at the mobile breakpoint only, reclaiming ~40-45px from the single largest
  line item in the dock's height budget. `.option-plate` already has an explicit `min-height: 44px`
  floor, so this cannot regress the touch-target-size requirement.
- Trim `.answer-roster-wrap`'s own gap (`0.45rem` → `0.3rem`) for a small additional margin.
- Net effect, measured: a typical Land Grab `Choice` question's `.shell-dock` content now fits
  within the 70dvh cap with `AnswerRoster` fully visible unscrolled (`dockScrollHeight` 463px vs
  `dockClientHeight` 461px, down from 522-552px before this change, on the same viewport/question
  length class). Genuinely long question/option text can still exceed the cap and fall back to the
  dock's existing (unchanged, still spec-sanctioned) internal scroll - this fix narrows how often
  that fallback is needed, it doesn't remove the fallback itself.
- Fixed a pre-existing, unrelated `tests/e2e` regression found while re-running the suite as this
  change's verification gate: `kick-player.spec.ts`'s `answerQuestionIfAsked` helper still clicked
  `.numeric-input-row button.primary`, a selector removed by the prior
  `battle-numeric-question-remove-duplicate-submit` change in this same session. Updated it to the
  keypad's stable `data-testid="keypad-submit"`. Confirmed via `git stash` that this failure
  predates and is unrelated to this change's own CSS edit.

## Capabilities

### Modified Capabilities
- `mobile-viewport-interaction`: no requirement text change - this is a spacing adjustment that
  makes the existing "dock becomes internally scrollable" fallback trigger less often for
  `AnswerRoster` specifically, consistent with the existing "fits without scrolling" requirement.

## Impact

- `src/Triviador.Client/src/App.css` (mobile breakpoint only).
- `tests/e2e/specs/kick-player.spec.ts` (test-selector fix, unrelated regression found via the
  verification gate).

## Known issue found but out of scope for this change

A sufficiently long `Choice` question (long prompt text and/or long option strings wrapping to 2
lines each) can still exceed `.shell-dock`'s 70dvh cap even after this trim, and the roster then
still needs the dock's internal scroll to reach - sampled during verification at roughly 60-90px
over budget in the worst observed case, vs. 460-550px+ before. A future iteration could look at a
more adaptive approach (e.g. collapsing `AnswerRoster` to a single summary line, or scaling
`.option-plate` further, when the dock's own `scrollHeight` measurably exceeds its `clientHeight`)
if this still shows up often in practice.
