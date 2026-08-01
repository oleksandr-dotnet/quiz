## Context

The client's visual identity ("heraldic paper") was established by
`openspec/changes/archive/2026-08-01-parchment-visual-overhaul`: design tokens in `theme/tokens.css`
(paper/ink/gilt/seat palette, `--r-*` radii, `--dur-fast/mid/slow` durations zeroed under
`prefers-reduced-motion: reduce`), a grain+vignette paper surface in `theme/paper.css`, Fraunces/Inter
fonts in `theme/typography.css`, a persistent `AppShell` with `motion`-driven `AnimatePresence`
cross-fades between phase docks, and a handful of plain CSS `@keyframes` in `App.css` (`claim-wash`,
`map-shake`, `marching-ants`/`contested-pulse`, `timer-pulse`, `banner-in`, `gilt-shimmer`). That
change covered the *mechanical* feedback obligations (`client-presentation` spec: actor/countdown/
affordance, non-silent state changes, connection loss, reduced motion) but not emotional polish -
the landing/lobby screens are functional but plain, phase transitions are a single generic
opacity/y fade regardless of which phase is entering, and a win renders identically to a loss/draw
except for headline text (the same `gilt-shimmer` text-only pass).

A second, in-flight change (`openspec/changes/mobile-optimization/`) owns the map's pinch/pan/zoom,
orientation nudge, and touch-target sizing - this change does not touch any of that, nor
`components/map/**` (a parallel track reworking the map into abstract shapes) nor
`RevealOverlay.tsx`'s Tip/numeric visualization internals (a parallel track replacing it with an
archery-target reveal animation).

## Goals / Non-Goals

**Goals:**
- Make the everyday experience (buttons, cards, roster, timer, toasts) feel tactile and alive, not
  just correct.
- Give phase transitions and the win moment enough visual distinction that players register them as
  *events*, not incidental state updates.
- Do this entirely within the existing token/animation conventions so the work composes with the
  other three in-flight tracks instead of colliding with them.

**Non-Goals:**
- No new server projections, DTO fields, or `contracts.ts` changes - everything here is derivable
  from `GameView` fields the client already has (`outcome.winnerPlayerIds`, `youPlayerId`, `phase`).
- No changes to the map (`components/map/**`) or to `RevealOverlay.tsx`'s reveal layout/animation.
- No new npm dependency - `motion` is already a dependency and covers everything proposed here
  (spring physics, `AnimatePresence`, staggered children); plain CSS `@keyframes` covers the rest,
  matching the existing idiom.
- No sound - "sound-adjacent visual clicks" means a tactile *visual* press state, not actual audio.

## Decisions

**Per-phase transition variants, not a single shared fade.** `AppShell`'s dock `AnimatePresence`
today always uses the same `{opacity, y: 8}` in/out regardless of which phase is entering. This
change gives `AppShell` a small `dockKey -> variant` mapping (e.g. Results uses a slightly larger
rise + scale to feel like a "reveal", Battle uses a sharper/quicker snap to feel tense, Base
Selection/Land Grab keep the existing gentle fade) so the transition itself hints at tone. Kept as a
lookup table inside `AppShell.tsx` (a prop-less internal concern, no new prop surface) rather than
per-screen bespoke `AnimatePresence` blocks, so the "map never unmounts, only the dock cross-fades"
invariant from the original design stays centralized in one place.

**Win celebration is a self-contained overlay component driven by existing `GameView` fields.** A
new presentational-only piece inside `ResultsScreen.tsx` reads `outcome.winnerPlayerIds` and
`view.youPlayerId` (both already on `GameView`) to decide whether the viewer is the sole winner, and
if so mounts a burst of gilt/heraldic flourish elements (CSS-driven, generated via a small fixed-size
array - no canvas, no new dependency) positioned via CSS custom properties per-particle (angle/
delay/distance), respecting `--dur-*`. Under reduced motion the component renders nothing (the
existing headline/standings/banner already communicate the same outcome per the `client-presentation`
spec's reduced-motion requirement).

**Ambient depth stays additive to `paper.css`'s existing `body::before/::after` layers.** Rather than
introducing a new full-viewport element, the vignette/glow is strengthened via the existing `::after`
radial-gradient layer plus one new subtle layer (a very-low-opacity radial "glow" that gently
breathes via a slow, near-imperceptible `@keyframes`, gated out entirely under reduced motion) so
there is still exactly one grain layer and one depth layer per the original design's minimal-DOM
approach - no new fixed-position elements added to every screen.

**Button/card tactility via new additive tokens, not replacing existing ones.** New tokens appended
to `theme/tokens.css` (e.g. a press-scale value, a hover-lift shadow) are consumed by `index.css`
button rules and `.paper-card`/`.player-card`/`.seat` rules already present in `App.css`. Existing
token names (`--gilt-500`, `--shadow-card`, `--dur-fast`, etc.) are read, never renamed, so other
in-flight tracks referencing them are unaffected.

**Roster/Timer/Toast entrance animation reuses the `banner-in`/`AnimatePresence` pattern already in
the codebase**, rather than inventing a new animation primitive: `PlayerRoster` gains a mount/update
stagger via `motion`'s `AnimatePresence`+`layout` on list items (a card joining/leaving the roster,
e.g. on elimination, animates in/out instead of popping); `Toast` gains an enter/exit transition
(currently mounts/unmounts with no transition at all); `Timer` gets a slightly more pronounced
critical-state pulse consistent with the existing `timer-pulse` keyframe, not a replacement of it.

## Risks / Trade-offs

- **[Risk] A per-phase transition table could feel inconsistent if variants are too different from
  each other.** → Mitigation: all variants share the same easing curve (`--ease-paper`) and the same
  duration tokens, varying only distance/scale/duration-tier, so they read as one family "louder or
  quieter," not unrelated animations.
- **[Risk] A CSS-only particle burst can look cheap if overdone.** → Mitigation: kept small (a
  handful of elements), themed entirely in gilt/ink tones with heraldic motifs (rays/sparks), and
  capped to a single ~1.5-2s run tied to entering the results screen, not looping.
- **[Trade-off] Per-phase transition variants add a small lookup table to `AppShell.tsx`** instead of
  keeping it fully generic. Accepted because the alternative (bespoke `AnimatePresence` in every
  screen) reintroduces the duplication the original shell was built to eliminate.

## Migration Plan

Client-only, additive CSS/token/component change with no server dependency and no data migration.
Ships as a single client build; rollback is reverting the commit. No `GameRules`, DTO, or
`contracts.ts` changes, so no coordination needed with the server or the other three in-flight
tracks beyond the file-ownership boundaries already agreed.

## Open Questions

None outstanding - scope, ownership boundaries, and the reduced-motion/token-additivity constraints
were fixed before this design was written.
