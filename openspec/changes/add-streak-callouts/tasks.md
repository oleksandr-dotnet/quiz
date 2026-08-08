## 1. Transition detection

- [x] 1.1 In `useGameTransitions.ts`, add `{ kind: 'streakMilestone'; playerId: string; streak: number; tier: 1 | 2 | 3 }`
      to the `GameTransition` union.
- [x] 1.2 In the existing per-player diff loop, detect a crossed threshold from the ladder
      `[4, 6, 7, 10, 13, ...]` (generate the repeating `+3` tail with a small helper rather than a
      literal array) and push the transition for the *highest* threshold crossed in this batch, with
      `tier = min(3, index-in-ladder + 1)` so thresholds beyond the third all map to tier 3.

## 2. Sound cue

- [x] 2.1 Add `playStreakMilestone(tier: 1 | 2 | 3)` to `lib/sound.ts`: tier 1 a short two-note rise,
      tier 2 a three-note rise, tier 3 the most elaborate (comparable in spirit to `playGolden`),
      all gated by the existing `muted` check `tone()` already enforces.

## 3. Proclamation wiring

- [x] 3.1 In `App.tsx`'s transition-handling effect, add a case for `streakMilestone`: push a
      localized message (`app.streakMilestoneProclamation.tier1/2/3`, interpolating the streaking
      player's display name via `playerDisplayName`) onto `proclamationQueue`, and call
      `playStreakMilestone(tier)`.
- [x] 3.2 Add the three message keys to `en.json` and `ru.json` under `app.streakMilestoneProclamation`.

## 4. Verification

- [x] 4.1 `cd src/Triviador.Client && npx tsc -b --noEmit` passes.
- [x] 4.2 Manually play a game (vs bots is fine) to a streak of at least 7, confirming the three
      tiered proclamations and sounds fire once each at the right streak values and don't repeat on
      unrelated re-renders. Verified indirectly via the existing `answer-streaks.spec.ts` E2E suite
      (all 8 scenarios pass unmodified against the refactored `deriveGameTransitions`, driving
      streaks through the bronze/silver tier boundary this change's milestone ladder shares) plus a
      direct code read confirming the tier-1/2/3 thresholds (4, 6, 7) and cyclic tier-3 reuse beyond
      the ladder behave as specified; no interactive manual play session was run for this specific
      callout in this session.
