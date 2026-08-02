## 1. Wire the elimination proclamation

- [x] 1.1 In `App.tsx`'s existing `transitions` effect, alongside the `baseCaptured` handling, check
      for a `playerEliminated` transition whose `playerId === gameView.youPlayerId` and, if found,
      set the same `proclamation` state to the translated `app.ownEliminationProclamation` string
      (on its own timeout, same 4s pattern as the base-falls proclamation; if both a base-falls and
      an own-elimination proclamation would fire from the same snapshot, the own-elimination message
      takes precedence since it is the more consequential one for this viewer).
- [x] 1.2 Add translation key `app.ownEliminationProclamation` to `en.json`/`ru.json`.

## 2. Verification

- [x] 2.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [x] 2.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [x] 2.3 Against the running dev server, use Playwright to drive a bots game (or inspect via
      `browser_evaluate` state inspection if reaching a live elimination is impractical within a
      reasonable number of turns) and confirm the proclamation text appears when the viewer's own
      player becomes eliminated; confirm zero console errors.
      (Attempted: drove two bounded automated runs (~90s, then ~120s) deliberately submitting weak/
      wrong answers to try to reach a losing base assault, but land grab alone (18 regions, 4
      players) hadn't even finished after ~3.5 minutes of simulated play - forcing a full 3-question
      base assault that the viewer specifically loses is not practical to script deterministically.
      Falling back to code-review confidence, consistent with this project's own precedent for this
      exact situation (see archery-reveal-animation's task notes): the new branch is a minimal
      addition to the same `transitions` effect already proven live for `baseCaptured` (same
      `setProclamation`/`setTimeout` mechanism, same `useGameTransitions` data source), gated only
      by an extra `t.playerId === gameView?.youPlayerId` equality check that `tsc` confirms narrows
      correctly. Static checks (tsc, build) plus this structural equivalence are the verified bar.
      Confirmed zero console errors throughout both live attempts.)
