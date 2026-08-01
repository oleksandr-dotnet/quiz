## Why

The parchment visual identity landed in `2026-08-01-parchment-visual-overhaul` gave the game a
cohesive look and covered the mechanical feedback obligations (`client-presentation`: actor/
countdown/affordance, non-silent state changes, connection loss, reduced motion). It did not aim
for emotional polish: the landing/lobby first impression is plain, phase transitions are a single
generic fade, and a game-winning moment renders as the same shimmering headline text as every other
screen with no sense of occasion. The user wants players to *want* to keep playing and come back -
that requires the win moment, first impression, and everyday micro-interactions to feel considered,
not just functional.

## What Changes

- Richer, phase-aware transitions in `AppShell`/`App.tsx`'s dock cross-fade (still `motion`-driven,
  still additive to the existing `AnimatePresence` usage) so moving between Base Selection -> Land
  Grab -> Battle -> Results reads as a sequence of distinct beats rather than one repeated fade.
- A heraldic-styled win celebration on `ResultsScreen` when the viewer's own player is among the
  winners (gilt spark/banner-flourish motif, not generic confetti), replacing today's plain
  shimmering headline as the sole feedback for winning.
- Ambient parchment depth (a subtle vignette/glow layer, tasteful and non-distracting) extending
  `theme/paper.css`'s existing grain/vignette treatment.
- Livelier, tactile micro-interactions on buttons and cards (press/hover states) defined via new
  additive tokens in `theme/tokens.css` and rules in `index.css`/`App.css`.
- Stronger first-impression visuals on `LandingScreen` and `LobbyScreen` (presentation only - no
  new fields, no new commands).
- Smoother `PlayerRoster`, `Timer`, and `Toast` animations (entrance/exit, not just the score
  odometer that already exists).
- All new animation is additive to the `--dur-fast/mid/slow` reduced-motion convention already in
  `theme/tokens.css` - no new duration source is introduced.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `client-presentation`: adds a requirement that a viewer's own game-winning outcome SHALL receive
  a distinct celebratory presentation, not just the same treatment as a loss/draw.

## Impact

- `src/Triviador.Client/src/theme/tokens.css`, `theme/paper.css` - additive tokens, ambient depth
  layer.
- `src/Triviador.Client/src/index.css`, `App.css` - button/card micro-interaction rules, new
  keyframes for roster/timer/toast entrance and the win celebration.
- `src/Triviador.Client/src/screens/LandingScreen.tsx`, `LobbyScreen.tsx`, `ResultsScreen.tsx`,
  `BaseSelectionScreen.tsx`, `BattleScreen.tsx`, `LandGrabScreen.tsx` (presentation only).
- `src/Triviador.Client/src/components/AppShell.tsx`, `Timer.tsx`, `Odometer.tsx`,
  `PlayerRoster.tsx`, `ConnectionBadge.tsx`, `Toast.tsx`, `RotateDeviceGate.tsx`.
- No changes to `Triviador.Domain`, `Triviador.Application` DTOs/contracts, `contracts.ts`, the map
  components under `components/map/**`, or `RevealOverlay.tsx`'s reveal visualization internals.
