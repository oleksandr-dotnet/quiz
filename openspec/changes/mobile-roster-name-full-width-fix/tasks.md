## 1. Give player-name a guaranteed full-width line at the mobile roster breakpoint

- [x] 1.1 In `src/Triviador.Client/src/App.css`'s `.shell-roster` mobile breakpoint, set
      `.player-card { flex-wrap: wrap; row-gap: 0.1rem; }`
- [x] 1.2 Add `.shell-roster .player-name { order: -1; flex-basis: 100%; }`

## 2. Verification

- [x] 2.1 `cd src/Triviador.Client && npx tsc -b --noEmit` passes (CSS-only change, expected no-op)
- [x] 2.2 `dotnet build` passes (verified via a non-conflicting `-o` output path since the local dev
      server holds a file lock on the default `bin/` output - unrelated to this change)
- [x] 2.3 Live Playwright check at all three target devices (393x659 iPhone 16, 402x681 iPhone 17,
      421x840 OnePlus 13R) plus the existing 932x430 short-landscape regression case: reach
      `BaseSelection` with a full 4-player roster, confirm `.player-name`'s rendered width is within
      rounding of its `scrollWidth` (full text, no clipping) and `document.scrollingElement`
      shows no new scroll/overflow in any dimension
- [x] 2.4 `npm test` in `tests/e2e`: 12 of 16 tests fail both with and without this change (confirmed
      via `git stash`) - pre-existing, unrelated to this fix, flagged in the proposal for a future
      iteration rather than blocking this one
