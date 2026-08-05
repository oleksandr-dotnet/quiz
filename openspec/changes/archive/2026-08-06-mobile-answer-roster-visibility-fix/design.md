## Context

`.shell-dock` (mobile breakpoint, `App.css`) caps its content at `max-height: 70dvh` with
`overflow-y: auto` as a deliberate, spec-sanctioned fallback for content that genuinely can't fit
(see `mobile-viewport-interaction`'s "dock becomes internally scrollable" requirement). During Land
Grab/Battle answering, `.shell-map` is already collapsed to `display: none` (an earlier optimization
freeing the map's row entirely), so the dock is the sole remaining consumer of leftover vertical
space below the top bar and player roster.

Measured on iPhone 16 (393×659, the narrowest first-class target): top bar + player roster + shell
padding consume ~178px before the dock even starts, leaving ~461-465px of true ceiling for the dock
regardless of its own `70dvh` figure (`70dvh` of 659px ≈ 461px, which is already close to the hard
outer limit). `QuestionCard` for a routine 4-option `Choice` question measured 392-421px on its own;
`AnswerRoster` needs another ~61px. That arithmetic doesn't fit even in the *shortest* observed case
before this change (dock content 491px vs 461px cap), which is why `AnswerRoster` was reliably
invisible-by-default rather than only in a rare long-text edge case.

## Goals / Non-Goals

- Goal: make the common/typical-length Land Grab question fit `AnswerRoster` fully within the dock's
  visible area, no scroll needed.
- Goal: preserve the `min-height: 44px` touch-target floor on every option button.
- Non-goal: guarantee *every* possible question/option text length fits without the dock's scroll
  fallback - that fallback exists by design for genuine outliers and remains unchanged here.
- Non-goal: touch `.shell-roster` or revert the prior roster-name fix - that fix is correct and
  necessary on its own terms; this change works within the space it leaves rather than clawing space
  back from it.

## Decision

Trim `.option-plate` and `.choice-options` spacing at the mobile breakpoint (largest, safest lever:
`.option-plate` already has an explicit `min-height: 44px` override guarding the touch-target
requirement, so padding above that floor is pure visual whitespace, not functional room). This is
scoped to the existing `@media (max-width: 900px), (max-height: 500px)` block, so desktop layout is
untouched.

Alternatives considered:
- **Raise `.shell-dock`'s `70dvh` cap when the map is hidden.** Rejected: measured the actual outer
  ceiling (shell height minus top bar/roster/padding) at ~461-465px on iPhone 16 - already almost
  exactly what `70dvh` evaluates to on this viewport, so raising the percentage figure wouldn't
  meaningfully increase available room; the real constraint is the *outer* budget, not the `70dvh`
  number itself.
- **Shrink `.shell-roster` further to reclaim the line the prior roster-name fix added.** Rejected:
  would risk reintroducing the 0px-name-collapse bug that fix exists to prevent; safer to work within
  the space that fix leaves than to re-litigate it.
- **Remove or condense `AnswerRoster` itself (e.g. count-only, no per-player stamps).** Rejected as
  the primary fix for this change: it changes what information is shown, not just how much room it
  takes, which is a bigger product decision than this pass warrants. Flagged in the proposal as a
  possible follow-up if the dock still commonly exceeds budget after this trim.

## Risks / Trade-offs

- Slightly denser option buttons (padding `0.85em 1.1em` → `0.6em 0.9em`) at the mobile breakpoint
  only - mitigated by the untouched `min-height: 44px` floor, verified via live measurement post-fix
  (`.option-plate` still measured 59px minimum on sampled real questions).
- Does not fully close the gap for the longest possible question/option text - explicitly flagged
  as a known remainder in the proposal rather than silently left unverified.
