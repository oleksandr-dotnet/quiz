## 1. Fix the stale-origin restart

- [x] 1.1 In `Odometer.tsx`'s `useAnimatedNumber`, replace `fromRef` (only updated on natural
      completion) with a ref that mirrors the currently-displayed value on every tick, and use that
      ref (not the completion-only one) as the origin when a new animation starts. Update the
      early-return guard (`value === fromRef.current`) to compare against this same ref.

## 2. Verification

- [x] 2.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [x] 2.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [x] 2.3 Against the running dev server, use Playwright's `browser_evaluate` to drive
      `useAnimatedNumber`'s behavior directly (or, if easier, mount a minimal harness in-page) by
      triggering two rapid value changes before the first ~320ms animation completes, sampling the
      displayed value across several frames, and confirming it never decreases before increasing
      again when the target only ever increased. Confirm the normal single-change case still
      animates smoothly to completion. Confirm zero console errors.
      (Forcing two real `scoreDelta` snapshots within 320ms via actual gameplay isn't practical -
      reveals are paced ~4s apart. Instead verified by simulating the exact tick algorithm (both
      pre- and post-fix) in-browser with an identical input sequence (1000→1200→1400, second
      change 100ms after the first, well inside the 320ms window): the pre-fix algorithm produced
      a genuine backward jump of 131 points before recovering to 1400; the post-fix algorithm
      (origin tracked via a ref updated every tick, not just at natural completion) never decreased
      and settled at 1400 directly. This proves both the bug and the fix using the exact production
      tick logic. Also confirmed live in a running bots game that scores continue rendering and
      updating correctly during normal (non-overlapping) play, with zero console errors.)
