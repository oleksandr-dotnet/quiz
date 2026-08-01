## Context

`RevealOverlay.tsx` renders a ranked list for every resolved question, plus (only for `Tip`/numeric
questions) a `NumberLine`: a horizontal 0-100% track with a correct-answer tick and per-player pins
positioned by `(value - min) / (max - min)` where `min`/`max` span the correct answer and all
submitted values. It's shared, unmodified, between land grab's non-blocking 3s reveal and battle's
`RevealHold` window, both of which pass the same `prompt` / `correctAnswer` / `answers` props. This
change only touches the `Tip` branch and adds a new component; the `Choice` branch (ranked list)
and the props contract are untouched.

`answers: readonly RevealedAnswerView[]` already carries `{ playerId, answer, rank, elapsedMs }`
per player, ranked server-side by `AnswerRanker` (Tier, then Penalty = `|answer - correct|`, then
elapsed time, then tie-break order). The client does not need to recompute ranking - only distance
for radius placement, which the existing `NumberLine` already derives the same way (`answer -
correct`).

## Goals / Non-Goals

**Goals:**
- Turn "how close was my guess" into a spatial, visually satisfying archery-target reveal.
- Reuse `rank` (already correct per the shared kernel) to drive stagger order; only *radius* is
  independently computed client-side from the raw values, purely for layout.
- Stay inside `RevealOverlay.tsx` + one new component + scoped CSS. Zero prop/contract changes.
- Full parity under `prefers-reduced-motion` and at mobile viewport widths.

**Non-Goals:**
- Changing anything about the `Choice` reveal branch, ranking, or scoring.
- New DTOs, new server data, or new i18n-driven text beyond reusing existing `reveal.*` keys plus
  possibly one or two new ones for the target (kept minimal).
- Physically-accurate projectile animation - this is a stylized micro-animation, not a physics sim.

## Decisions

**SVG over DOM/CSS-positioned circles.** The rings, bullseye, and arrows are all radial geometry
(circle + angle + radius). SVG gives free scaling to any viewport width via `viewBox` (mobile
requirement) without manual percentage math for every element the way `NumberLine`'s absolute-CSS
pins did. `WaxSeal.tsx` already establishes the pattern of `motion.g` inside an SVG for animated
per-player map markers - this component follows the same idea, just standalone rather than
map-anchored.

**Radius formula.** For each answer with `answer.kind === 'Numeric'`:
`distance = Math.abs(answer.numericValue - correctAnswer.numericValue)`.
`maxDistance = Math.max(...allDistances, epsilon)` (epsilon avoids div-by-zero when every answer is
exactly correct). `radiusFraction = distance / maxDistance`, mapped linearly to
`[innerRadius, outerRadius]` in SVG user units so a perfect answer sits at/near the bullseye rather
than a hard 0px stack, and the worst answer sits at the outer ring, never off the target. This is
the same normalize-by-spread idea as `NumberLine`'s min/max percent, just radial instead of linear.

**Angle assignment: even distribution by rank, not by value.** If angle were derived from the
answer's sign/magnitude, players who guessed the same number would overlap exactly and players
clustered together would collide. Instead each arrow gets an evenly-spaced angle slot
(`-90deg + i * 360/n`, `i` in rank order) so `n` arrows are always visually separated regardless of
how close their raw guesses are - readability wins over "true" directional meaning, which the
prompt data doesn't provide anyway (there is no natural "direction" for a numeric guess, only
magnitude of error).

**Stagger order: worst-to-best.** Rank order is walked in reverse (highest rank number/furthest
first) so the closest guess - the one the room is waiting to see - lands last, mirroring the
existing laurel-numeral ranked list convention of rank 1 being the payoff. Each arrow's animation
delay is `(n - 1 - index) * staggerStepMs` in rank-ascending array order, i.e. index 0 (rank 1)
gets the largest delay.

**Motion approach: one spring transition per arrow, not a manual multi-keyframe sequence.** A
`motion.g` per arrow animates from an off-target `initial` (outside the outer ring, scaled down,
`opacity: 0`) to its computed `(radius, angle)` position with `type: 'spring'`, tuned with a bit of
overshoot (similar to `WaxSeal`'s `stiffness: 260, damping: 14`). Spring overshoot alone reads as a
"thunk" (it overshoots past the landing point and settles back) without hand-authored keyframes,
keeping the component small. `onAnimationComplete` adds a `landed` class per arrow that triggers a
short CSS `@keyframes arrow-thunk` (scale pulse) for a crisper impact accent layered on top of the
spring settle, and reveals the name label (label fades in only once landed, so it never overlaps a
still-flying arrow).

**Reduced motion: skip motion entirely, don't just zero durations.** Following `Odometer.tsx`'s
existing local `prefersReducedMotion()` (a plain `matchMedia('(prefers-reduced-motion: reduce)')`
check, not a `motion/react` hook - kept consistent with that existing convention rather than
introducing a second way to detect it), when reduced motion is active the component renders every
arrow directly at its final `(radius, angle)` with `initial === animate` (no spring, no stagger
delay, no `arrow-thunk` class), and labels are visible immediately. This mirrors
`useAnimatedNumber`'s existing "collapse to instant" pattern rather than merely setting
`transition: { duration: 0 }` (which would still run a spring's overshoot math even at zero
duration in some cases) - explicit branching is simpler to reason about and test.

**CSS location: new dedicated stylesheet, not `App.css`.** A `visual-polish` track is also editing
`App.css`/`tokens.css` in parallel; to minimize merge conflicts this change adds a small new file
(e.g. `ArcheryTargetReveal.css`, imported directly by the new component) for the `arrow-thunk`
keyframe and any layout classes SVG attributes can't express (e.g. the label's text styling,
container sizing). Ring/bullseye/arrow geometry itself is expressed via SVG attributes
(`cx`/`cy`/`r`/`fill`) computed in TSX, not CSS classes, so most of the visual is prop-driven rather
than stylesheet-driven.

**Colors: reuse `colorForPlayer`/`SEAT_COLORS` verbatim.** Same as `NumberLine`'s pins - no new
palette.

## Risks / Trade-offs

- **[Risk] Many players near-identical answers could still visually crowd the target at small
  radii.** → Mitigation: even-angle-slot assignment (not value-based angle) keeps arrows separated
  regardless of radius clustering; label placement nudges radially outward from the arrow tip so
  labels stay legible even when arrows sit close to center.
- **[Risk] SVG `viewBox` scaling could make labels too small to read on narrow phone widths.** →
  Mitigation: label text uses a fixed-ish `px`-equivalent via SVG `font-size` tuned against a known
  `viewBox`, and the container has a `min-width`/`max-width` clamp consistent with other reveal
  overlay content so the target never shrinks below a legible size; verified visually at a mobile
  viewport during implementation.
- **[Risk] Spring-based landing timing varies slightly with stiffness/damping tuning, making the
  "worst-to-best" stagger feel uneven if arrows overtake each other.** → Mitigation: stagger delay
  gap is kept comfortably larger than one spring's typical settle time so arrows don't visually race
  past one another.
- **[Trade-off] Radius is normalized per-question against that question's own answer spread, not an
  absolute error scale.** → Same trade-off `NumberLine` already made (percent-of-min/max); keeping
  it means one bad outlier answer compresses everyone else's radius differences, but avoids needing
  a magnitude-aware absolute scale the prompt data doesn't provide (no known "reasonable range" per
  question).

## Migration Plan

Purely additive/replacement within a single client component tree; no data migration. Land as one
change: remove `NumberLine`, add `ArcheryTargetReveal`, wire it into `RevealOverlay`'s `Tip` branch.
Rollback is a plain revert (no persisted state, no server coupling).
