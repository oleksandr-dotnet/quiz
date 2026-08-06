## Why

The current "parchment" theme (introduced in `parchment-visual-overhaul`) puts nearly everything -
page background, cards, the map itself, buttons - in one narrow pale-cream band (`#faf6ea`-ish),
with a serif display headline and a warm gold accent. That combination is, almost verbatim, the
generic look AI design tooling defaults to when a brief isn't pinned down, and it reads that way in
the running app: low value contrast everywhere, the map (the actual game) rendered small inside a
large padded gray box with dead space on every side, and landing/lobby screens that look like a
SaaS onboarding card floating in beige void rather than a conquest map. The existing heraldic asset
language - wax-seal bases with crowns and monograms, per-seat hatch patterns, the Fraunces/Inter
type pairing - is genuinely good and on-theme; it's the canvas around it that needs to change, not
the vocabulary.

## What Changes

- Replace the all-cream canvas with a dark warm-walnut "war table" background
  (`--table-950 #14100a` primary, `--table-800 #241c12` recessed panels/rails). The existing
  `--paper-*` cream scale is kept, but scoped to the map surface and scroll/card elements only - it
  becomes a material *on* the table, not the whole page.
- The map becomes the full-viewport hero on the base-selection/land-grab/battle screens: remove the
  padded gray container, add a soft radial "lamplight" glow behind the map so it reads as lit rather
  than placed, and shrink the roster/HUD to a slim brass-edged rail instead of a competing white
  block.
- Landing/account-setup/lobby screens change from a centered SaaS card floating in beige space to a
  "scroll on the table" treatment: dark full-bleed background, the sign-in/room-join surface as a
  physical parchment object with weight (shadow/edge treatment), not a flat centered rectangle.
- Seat heraldry (crimson/indigo/forest/ochre) is retuned ~8-10% brighter/more saturated so it reads
  as jewel tones against the dark table instead of muted tones against cream; the per-seat hatch
  patterns and wax-seal/crown iconography are unchanged in mechanism, only recolored.
- `--gilt-*` gold tokens are repurposed as "brass" framing accents (dividers, small-caps eyebrow
  labels, panel edges) - reused, not replaced.
- Fraunces/Inter typography pairing is unchanged; display-face scale is pushed harder at headline
  moments (landing title, room code, phase banners) instead of staying at its current modest size.
- Rollout is incremental and screen-by-screen: theme tokens + `LandingScreen` first as the proof
  point (verified via Playwright screenshots), then `BaseSelectionScreen`/`GameMap` (highest value,
  since it's the actual game board), then the remaining screens
  (`AccountSetupScreen`, `LobbyScreen`, `LandGrabScreen`, `BattleScreen`, `ResultsScreen`, shared
  activity components).
- Existing mobile responsiveness is preserved throughout - this changes color/contrast/composition,
  not breakpoints or layout structure on small viewports.

No behavior changes: this is a token, palette, and layout-composition change only. It does not
change what the client renders (still server-projected state only), when it renders it, or any
existing accessibility mechanism (region shapes keep their accessible names, decorative layers stay
`aria-hidden`, hatch patterns keep distinguishing ownership independent of hue). `skip_specs: true`
applies - see Capabilities below.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
(none - no spec-level requirement changes; see Why/What Changes)

## Impact

- **Theme tokens**: `src/Triviador.Client/src/theme/tokens.css`, `paper.css`, `typography.css`
  (or their current equivalents) - background/panel/seat-color token values, new `--table-*` and
  brass-alias tokens.
- **Screens**: `LandingScreen.tsx`, `AccountSetupScreen.tsx`, `LobbyScreen.tsx`,
  `BaseSelectionScreen.tsx`, `LandGrabScreen.tsx`, `BattleScreen.tsx`, `ResultsScreen.tsx` and their
  CSS.
- **Map/shared components**: `components/map/GameMap.tsx`, `RegionShape.tsx`, `HeraldicDefs.tsx`,
  `WaxSeal.tsx`, `ValueBadge.tsx`, `QuestionCard.tsx`, `AnswerRoster.tsx`, `RevealOverlay.tsx`,
  `Timer.tsx`, `Odometer.tsx`, `PlayerRoster.tsx`, `AppShell.tsx`/`AppMenu.tsx`, modals, `Toast.tsx`.
- **No changes** to `Triviador.Domain`, `Triviador.Application`, `Triviador.Infrastructure`, the
  SignalR contract, or `src/api/contracts.ts` - purely a client-side visual change.
