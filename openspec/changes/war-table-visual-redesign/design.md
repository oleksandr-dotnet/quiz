## Context

See `proposal.md` - Why / What Changes for motivation and scope.

Relevant current state:
- `src/Triviador.Client/src/theme/tokens.css` defines the whole palette as CSS custom properties:
  a `--paper-*` cream scale, `--ink-*` text scale, `--gilt-*` gold accent, four `--seat-N` heraldic
  colors ("muted so they sit on cream, not on black" per its own comment), `--wax`, `--unclaimed`,
  `--danger`, plus shadow/duration/easing tokens. `color-scheme: light` is set at `:root`.
- `src/Triviador.Client/src/theme/paper.css` applies `--paper-100` as the `body` background, layers
  a grain texture and a radial vignette/glow (`body::after`, already gold-tinted via `--glow-gilt`,
  already has a slow breathing animation respecting `prefers-reduced-motion`), and defines
  `.paper-card` (cream card, deckle/torn top edge, settle-in animation) - the shared "physical paper
  object" primitive used across screens.
- `src/Triviador.Client/src/theme/typography.css` sets Fraunces (display) / Inter (body) via
  `@fontsource-variable`.
- The map (`components/map/GameMap.tsx`) currently renders inside a padded container with a flat
  `--paper-200`/gray fill and no depth cue separating it from the page.
- Screens (`LandingScreen`, `LobbyScreen`, etc.) center a `.paper-card`-style surface on the plain
  cream body background.

## Goals / Non-Goals

**Goals:**
- Land a dark "war table" canvas with the map as a lit hero, while reusing existing primitives
  (`.paper-card`, the vignette/glow layer, the seat/gilt token names) rather than inventing a
  parallel system.
- Ship incrementally, screen by screen, each step visually verified with Playwright against the
  running dev server before moving to the next screen.
- Keep every existing behavioral/accessibility mechanism intact: `aria-hidden` decorative layers,
  hatch-pattern ownership distinguishability, `prefers-reduced-motion` handling, keyboard focus
  visibility.

**Non-Goals:**
- No new component library, no build tooling change (no Tailwind adoption - out of scope).
- No change to `GameView`/DTO shape, SignalR contract, or any server-side code.
- No redesign of information architecture (what's shown where) - this is palette, depth, and
  composition, not a UX flow change.
- Not attempting pixel-perfect final polish on every screen in one pass - later screens may need a
  follow-up pass once the pattern is proven on the first two.

## Decisions

**1. Add a `--table-*` scale and a `color-scheme` toggle, don't replace `--paper-*`.**
`--paper-*` stays exactly as-is and keeps meaning "the parchment material" - it now applies to the
map surface and `.paper-card` only, not `body`. New tokens: `--table-950: #14100a` (body background),
`--table-800: #241c12` (recessed panels: HUD rail, modal scrims, room-code chip). `color-scheme` on
`:root` changes from `light` to `dark` so native form controls (text inputs, the room-code boxes)
inherit sensible dark styling instead of fighting it with overrides.
*Alternative considered*: repoint `--paper-*` itself to dark values. Rejected - every existing
"paper = cream, ink = dark text on cream" assumption in component CSS would invert incorrectly
(e.g. `.paper-card` text would become unreadable), and it conflates two different materials (table
vs. parchment) that need to coexist on screen simultaneously (dark table behind a cream map).

**2. Repurpose `body::after`'s existing vignette/glow layer as the lamplight effect, per-screen.**
The glow (`--glow-gilt`, already a radial gradient, already breathing, already reduced-motion-safe)
moves from a page-wide `body::after` to being centered behind the map container and behind the
landing/lobby card specifically, so it reads as "this object is lit" rather than "the whole page has
an ambient tint." Mechanically: keep the animation/timing function, change what element it's
attached to and its size/position per screen.
*Alternative considered*: a single global fixed-position glow behind everything. Rejected - on
screens where the map is off-center or full-bleed this reads as a stage light on the wrong thing;
scoping the glow to the actual hero element on each screen keeps the "lit object" reading accurate.

**3. Seat colors get a brightness/saturation pass, not new hues.**
`--seat-0..3` and `--wax` are retuned via a mechanical HSL lightness bump (~8-10%, saturation +5-10%)
so they clear a comfortable contrast ratio against `--table-950`/`--table-800`, not just against
`--paper-050`. Hatch-pattern fills (`HeraldicDefs.tsx`) are unchanged in mechanism - only the
underlying color values shift. Region names/values on the map stay on the parchment map surface
(light background), so `--ink-*` text tokens do not need to change; only text that sits directly on
`--table-*` (HUD rail labels, roster names) needs a contrast check against dark.
*Alternative considered*: introduce a second "dark-mode seat" palette entirely separate from the
map's own seat colors. Rejected - two color systems for the same four players would break the
mental model ("my color is X") the moment a UI element moves between a table-colored rail and the
parchment map.

**4. `--gilt-*` is relabeled/reused as "brass" conceptually, values largely kept.**
`--gilt-500`/`--gilt-300` already read as warm metallic gold on cream; against near-black they read
even better (higher relative contrast) with no change needed. Used for: rail/panel border hairlines,
small-caps eyebrow labels (phase name, "OR JOIN AN EXISTING ROOM" divider text), focus rings. No
token rename in code (avoids a repo-wide find/replace for a cosmetic label) - "brass" is design
language for how `--gilt-*` is used now, not a new variable.

**5. Rollout order: tokens + `LandingScreen` → `BaseSelectionScreen`/`GameMap` → remaining screens.**
Landing is the smallest surface to prove the "dark table + lit card" pattern end-to-end (typography
scale push, card treatment, brass accents) with the least risk. Base-selection/map is next because
it's the actual game board and the highest-value fix (current padded-gray-box problem lives there).
Land-grab/battle screens reuse the same map + HUD-rail primitives once those exist, so they get
cheaper as we go. Results/lobby/account-setup follow last since they're closer in shape to landing.
*Alternative considered*: a single big-bang pass across all screens at once. Rejected per the user's
own stated preference for visual iteration - each screen gets screenshotted and critiqued before the
next one starts, which a big-bang change can't do mid-flight.

**6. Map "hero" treatment: full-bleed container, glow, and a grounding shadow - not new SVG art.**
`GameMap.tsx`'s wrapping container loses its fixed padded-gray-box styling; the map's `viewBox`
scales to fill available width/height (respecting existing mobile breakpoints, which already do this
reasonably per the earlier audit). A `box-shadow`/drop-shadow under the map's paper-colored group
gives it a "resting on the table" depth cue. No changes to `abstractGeography.ts`, region path data,
or `RegionShape.tsx` geometry - purely container/background/shadow CSS around existing SVG output.

## Risks / Trade-offs

- **[Risk] Seat-color contrast against `--table-950` may not hit WCAG AA for small text on first
  pass.** → Mitigation: check each retuned seat color's contrast ratio against both `--table-950`
  and `--table-800` before finalizing (existing `--seat-3` already carries a "darkened for 4.5:1"
  comment showing this project already tracks this manually); adjust lightness further if a ratio
  fails rather than shipping it.
- **[Risk] Native dark `color-scheme` can change unstyled control chrome (scrollbars, date pickers if
  any) in ways not explicitly designed.** → Mitigation: sweep each screen after the token change for
  any native control that picked up unwanted dark styling and override explicitly if so.
- **[Risk] Reworking `.paper-card`/`body::after` shared primitives affects every screen at once even
  though rollout is meant to be incremental.** → Mitigation: land the token/base-primitive change
  together with `LandingScreen` as one step (as scoped in proposal.md), screenshot *all* screens
  (not just Landing) after that step to catch any accidental regression on not-yet-redesigned
  screens, and fix forward immediately rather than deferring.
- **[Trade-off] Keeping `--paper-*` and adding `--table-*` instead of a single unified scale is more
  tokens to reason about.** Accepted - it correctly models two coexisting materials (table vs.
  parchment-on-table) rather than forcing one gradient to do both jobs.

## Migration Plan

Purely additive/CSS-level; no data migration. Deploy as a normal client build - no feature flag
needed since there's no server-side coupling. Rollback is a plain revert of the changed CSS/TSX
files if a step regresses visually; each screen-step is a separately reviewable/revertable unit per
the rollout order in Decision 5.
