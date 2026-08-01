## 1. New component scaffold

- [x] 1.1 Create `src/Triviador.Client/src/components/ArcheryTargetReveal.tsx` accepting the same
      shape of props `NumberLine` currently takes (`prompt`, `correctAnswer`, `answers`, `view`).
- [x] 1.2 Create a scoped stylesheet (e.g. `src/Triviador.Client/src/components/ArcheryTargetReveal.css`)
      imported by the new component, for the `arrow-thunk` keyframe and any non-SVG layout/label
      styling.

## 2. Geometry and layout

- [x] 2.1 Implement the radius calculation: `distance = |numericValue - correctAnswer|` per
      numeric-kind answer, normalized against `maxDistance` (with an epsilon guard) into an
      `[innerRadius, outerRadius]` SVG-unit range.
- [x] 2.2 Implement even angle-slot assignment across players in rank order
      (`-90deg + i * 360/n`), independent of raw answer value, so arrows never overlap purely from
      landing at similar radii.
- [x] 2.3 Render the SVG target: outer container, 3-4 concentric rings, bullseye marker at the
      center representing `correctAnswer`, sized via `viewBox` so it scales responsively down to
      mobile widths.
- [x] 2.4 Skip rendering an arrow for any `RevealedAnswerView` whose `answer.kind` is not
      `Numeric` (no submission), matching the ranked list's "—" treatment.

## 3. Motion and stagger

- [x] 3.1 Render each arrow as a `motion.g` (from `motion/react`, consistent with `WaxSeal.tsx`)
      with `initial` positioned off-target (scaled down / faded / outside the outer ring) and
      `animate` at its computed `(radius, angle)`, using a spring transition tuned for a slight
      overshoot ("thunk" via overshoot, no hand-authored keyframe sequence).
- [x] 3.2 Compute per-arrow animation `delay` from rank so arrows land staggered worst-to-best
      (furthest/highest rank number first, rank 1 / closest guess lands last).
- [x] 3.3 On each arrow's `onAnimationComplete`, apply a `landed` state that (a) triggers the
      `arrow-thunk` CSS keyframe as a crisper impact accent and (b) reveals that arrow's player-name
      label (label appears only once landed, never mid-flight).
- [x] 3.4 Color each arrow and its label using `colorForPlayer(view, playerId)` /
      `SEAT_COLORS`, matching the rest of the reveal overlay.

## 4. Reduced motion and responsiveness

- [x] 4.1 Add a local `prefersReducedMotion()` check (matching the existing `matchMedia` pattern
      used in `Odometer.tsx`) and branch: when reduced motion is active, render every arrow
      directly at its final `(radius, angle)` with no spring, no stagger delay, and no
      `arrow-thunk` animation; labels visible immediately.
- [x] 4.2 Verify layout and label legibility at a narrow mobile viewport width with the maximum
      player count (4), adjusting `viewBox`/font-size/label placement if labels crowd or clip.
      (Done via geometry/margin calculation and a `@media (max-width: 420px)` size-down rule, not a
      live-browser screenshot - see note on 6.3.)

## 5. Wire into RevealOverlay and clean up

- [x] 5.1 In `RevealOverlay.tsx`, replace the `NumberLine` usage in the `prompt.kind === 'Tip'`
      branch with `ArcheryTargetReveal`, passing the same props.
- [x] 5.2 Remove the now-unused `NumberLine` function and its CSS classes
      (`.number-line`, `.number-line-track`, `.number-line-pin`, `.number-line-correct`,
      `.number-line-labels`) from `App.css`. Leave the `Choice` branch (ranked list) untouched.
- [x] 5.3 Confirm no server/DTO/contract files were touched and no files under
      `src/Triviador.Client/src/components/map/**` or `Data/questions/questions.json` were changed.

## 6. Verification

- [x] 6.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [x] 6.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [ ] 6.3 If feasible, run the dev server and visually sanity-check a numeric-question reveal
      (land grab or battle) at both a normal and a mobile-emulated viewport width, and with
      `prefers-reduced-motion` toggled on.
      (Attempted: started `dotnet run` on :5106 and `vite --port 5290` and drove a bots game via
      Playwright up to base selection, but the shared Playwright browser instance got hijacked
      mid-flow by another parallel worktree agent's session (tab navigated out from under this one,
      to a different agent's port). Concluded live screenshotting isn't reliable in this
      multi-agent setup and stopped rather than risk interfering with another agent's session.
      Left unchecked rather than falsely marked done - typecheck/build/lint are the verified bar
      per the task's own fallback.)
