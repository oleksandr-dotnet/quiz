## Context

`.reveal-row` lays out each ranked reveal entry as a 5-column grid: laurel numeral, correct/incorrect
mark, player name, answer text (`1fr`, the flexible remainder), and a speed bar. At the file's default
(desktop/tablet-leaning) column widths - `1.8rem 1.5rem 8.5rem 1fr 5rem` - the fixed columns alone
already consume most of a phone-width card before the answer's `1fr` share gets anything, which an
earlier fix addressed by narrowing those fixed columns to `1.4rem 1.2rem 5rem 1fr 3rem` under
`@media (max-width: 420px)`.

That threshold was picked when the project's mobile testing was iPhone-centric (393-402px). Adding
OnePlus 13R (421px) as a target device exposed the gap: 421px is 1px over 420px, so it gets the wide
columns - not "no fix," but the *wrong* fix, since the wide columns leave measurably less room for
the answer than even the narrow columns would on a wider phone. This file already documents the
project's phone range elsewhere as "~360-450px" (`.player-card` comment) - a boundary the reveal-row
fix should have matched from the start.

## Goals / Non-Goals

- Goal: every phone this project targets (per the already-documented ~360-450px range) gets the
  narrow, answer-favoring column layout.
- Goal: zero change to the >460px (tablet/desktop) column layout or to any other `.reveal-row`
  behavior (ellipsis truncation, speed bar, laurel numerals all unchanged).
- Non-goal: redesign the column proportions themselves - the existing 5rem/1fr/3rem narrow split
  already works well (confirmed on iPhone 16/17 both before and after this change); the only defect
  was which viewports receive it.

## Decision

Widen the media query from `max-width: 420px` to `max-width: 460px`. 460 was chosen over exactly
matching the documented "450" upper bound to leave a small margin above the largest phone this
project has concretely measured (OnePlus 13R at 421px), without reaching far enough to risk pulling
in a small tablet or a desktop window resized narrow - the existing 900px query is where the
layout's real phone/desktop split happens, and 460px stays comfortably inside "phone" territory
under that.

Alternatives considered:
- **Match the value exactly to the 900px main breakpoint instead of a separate, smaller one.**
  Rejected: the narrow columns exist specifically because *very* narrow phones need every pixel
  reclaimed from name/speed-bar; a wide phone or small tablet in the 460-900px range has enough room
  for the original wider, more generously-spaced columns and doesn't need the reclaimed width
  budget. Keeping a distinct, smaller sub-breakpoint preserves that distinction.
- **Add a third, intermediate column set for the 420-460px band.** Rejected as unnecessary
  complexity - the existing narrow columns already render cleanly (verified by screenshot) on
  OnePlus 13R once they apply at all; there's no evidence a third tier would look meaningfully
  better than reusing the one that already works on the narrower iPhones.
