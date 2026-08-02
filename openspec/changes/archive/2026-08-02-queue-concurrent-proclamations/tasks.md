## 1. Queue-based proclamations

- [x] 1.1 In `App.tsx`, add a `proclamationQueue: string[]` state alongside the existing
      `proclamation: string | null` state.
- [x] 1.2 Replace the enqueue half of the existing `transitions` effect: compute the list of
      proclamation-worthy messages for the current batch (own-elimination first, then base-falls,
      same priority/text as today) and append all of them to `proclamationQueue` (not just the
      first match).
- [x] 1.3 Add a second effect keyed on `[proclamationQueue, proclamation]`: when `proclamation` is
      `null` and the queue is non-empty, shift the first message into `proclamation`, remove it from
      the queue, and start the existing 4s timeout that clears `proclamation` back to `null` on
      expiry (letting this effect re-fire and drain the next item, if any).
- [x] 1.4 Move the `baseDamaged` → `mapShaking` handling into its own effect keyed on `transitions`,
      independent of the proclamation enqueue effect, so it always fires when `baseDamaged` is
      present regardless of what else is in the same batch.

## 2. Incidental cleanup

- [x] 2.1 Remove the unused `reveal.correctTitle` key from `en.json` and `ru.json`.

## 3. Verification

- [x] 3.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [x] 3.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [x] 3.3 Against the running dev server, use Playwright to drive a bots game and confirm the
      existing single-proclamation cases still work (a base falling still shows the base-falls
      banner, own elimination still shows its own banner) with no regression in timing; if a
      concurrent-transitions scenario (both firing from the same snapshot) is impractical to force
      live within reasonable time, verify the enqueue/drain logic by directly invoking the relevant
      React state updates via `browser_evaluate` against exposed store state, or fall back to
      careful code-review confirmation, consistent with this project's precedent for such cases.
      Confirm zero console errors throughout.
      (Verified: drove a full bots game through land grab (~250s of continuous automated play,
      many `scoreDelta`/`regionClaimed` transitions exercising the refactored effects every
      question) into Battle with zero console errors throughout - no regressions from the
      refactor. Continuing into Battle, caught a real base capture: the "Знамя игрока Бот пало"
      base-falls proclamation fired correctly AND the map-shake fired in that same run - meaningful
      confirmation of the specific fix, since the *old* code's early-return would have skipped the
      map-shake check entirely whenever the `baseCaptured` branch also matched in the same batch.
      Did not separately force the own-elimination+base-falls double-fire case; that combination
      requires the viewer's own base to be the one captured, which earlier attempts this session
      showed is impractical to force deterministically. Confidence for that specific combination
      rests on the enqueue effect treating both sources identically and unconditionally.)
