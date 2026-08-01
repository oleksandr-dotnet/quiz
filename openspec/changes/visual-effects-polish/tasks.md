## 1. Tokens and ambient depth

- [x] 1.1 Add new additive tokens to `theme/tokens.css` (press-scale, hover-lift shadow, glow
      color/opacity) without renaming or removing existing tokens; ensure new durations/animations
      route through `--dur-fast/mid/slow`.
- [x] 1.2 Strengthen ambient depth in `theme/paper.css`: enhance the existing vignette and add one
      subtle breathing glow layer, gated to no-op under `prefers-reduced-motion: reduce`.

## 2. Tactile micro-interactions

- [x] 2.1 Add hover/press states to `button` rules in `index.css` (lift on hover, scale-down on
      `:active`) using the new tokens.
- [x] 2.2 Add hover/press polish to `.paper-card`, `.seat`, `.player-card`, `.option-plate` in
      `App.css`.

## 3. Phase-aware dock transitions

- [x] 3.1 In `AppShell.tsx`, replace the single shared `AnimatePresence` variant with a small
      `dockKey`-derived variant lookup (Results = reveal-style rise+scale, Battle = quicker/sharper
      snap, Base Selection/Land Grab = existing gentle fade) sharing `--ease-paper` and duration
      tokens.
- [x] 3.2 Verify the map-never-unmounts invariant still holds (map stays in its own stable slot,
      only the dock cross-fades).

## 4. Win celebration on Results

- [x] 4.1 Add a self-contained celebratory overlay/component used only from `ResultsScreen.tsx`,
      driven by `outcome.winnerPlayerIds` / `view.youPlayerId` (sole-winner case only), themed in
      gilt/ink heraldic motifs (sparks/flourish), CSS or `motion`-driven, no canvas/no new
      dependency.
- [x] 4.2 Ensure the celebration renders nothing under `prefers-reduced-motion: reduce` while the
      existing headline/standings/winner-banner remain unchanged.
- [x] 4.3 Add/adjust `data-testid` hooks if needed so the celebration's presence is inspectable
      without depending on animation timing.

## 5. Roster / Timer / Toast polish

- [x] 5.1 Give `PlayerRoster` list items mount/exit animation (e.g. `AnimatePresence` + `layout`)
      so a card joining/leaving (elimination) animates instead of popping.
- [x] 5.2 Add enter/exit transition to `Toast` (currently mounts/unmounts with no transition).
- [x] 5.3 Refine `Timer`'s critical-state pulse consistent with the existing `timer-pulse` keyframe.

## 6. Landing / Lobby first impression

- [x] 6.1 Strengthen `LandingScreen.tsx` presentation (heading treatment, button hierarchy, layout
      polish) within the existing paper-card idiom - no new commands/state.
- [x] 6.2 Strengthen `LobbyScreen.tsx` presentation (seat list, room-code/share affordance) within
      the existing paper-card idiom.

## 7. Verification

- [x] 7.1 `cd src/Triviador.Client && npx tsc -b --noEmit`
- [x] 7.2 `cd src/Triviador.Client && npm run build`
- [x] 7.3 Ran the client's own dev server (port 5183, since 5173 was occupied by a parallel agent's
      instance) and drove it with Playwright. The shared MCP browser session was repeatedly raced by
      the other parallel worktree agents' own navigations, so pixel screenshots could not be
      reliably retrieved from this run's sandbox, but accessibility snapshots at both 1440x900 and
      390x844 confirmed the Landing screen renders correctly (tagline, "or join an existing room"
      divider, all buttons/inputs present, no errors besides the expected SignalR negotiate failures
      from having no backend running). Typecheck + build (7.1/7.2) remain the primary verification
      bar per the instructions' fallback.
- [x] 7.4 Manually reviewed every animation added in this change: `--dur-cinematic` zeroed alongside
      `--dur-fast/mid/slow`; the ambient glow breathe, button hover/press transform, active-turn
      glow, and timer warn/critical pulses are all gated `@media (prefers-reduced-motion: reduce)`;
      the win celebration is skipped entirely in JS (and backed by a CSS `display: none`) when
      reduced motion is on; `AppShell`, `Toast`, and `PlayerRoster` each zero their `motion` transition
      duration via the new `usePrefersReducedMotion` hook.
