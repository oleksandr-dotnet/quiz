## 1. Reveal-row overflow fix

- [x] 1.1 Add `.reveal-name, .reveal-answer { min-width: 0; overflow: hidden; text-overflow:
      ellipsis; white-space: nowrap; }` to `App.css`
- [x] 1.2 Verify via an isolated CSS harness at 393×852, 932×430, 975×450: a `.reveal-row` with a
      long custom name no longer has `scrollWidth > clientWidth` (was 327 vs 319 before, now equal
      at all three sizes)

## 2. LandGrab reveal+next-question stacking fix

- [x] 2.1 Give `.shell-dock` (mobile breakpoint) `max-height: 70dvh; overflow-y: auto;`
- [x] 2.2 Verify via the same isolated harness (reveal-overlay with archery-target graphic +
      numeric QuestionCard+NumericKeypad stacked, matching LandGrabScreen's real structure): no
      document-level overflow at 393×852/932×430/975×450 (was previously fine only because the
      shell itself clips - the actual regression is #2.3), and `.shell-dock` itself now scrolls
      internally (`scrollHeight` 935-1481px against a `clientHeight` capped at 265-596px) rather
      than clipping unreachable content
- [x] 2.3 Regression-check the three already-verified single-state dock cases (BaseSelection on
      iPhone 16 portrait/OnePlus 13 portrait/iPhone 16 Pro Max landscape): confirm
      `shell-dock.scrollHeight === shell-dock.clientHeight` (the 70dvh cap never engages) so the
      fix is a no-op everywhere except the rare stacked-reveal case

## 3. Connection badge stacking fix

- [x] 3.1 Raise `.connection-badge`'s `z-index` from 50 to 200

## 4. Verification

- [x] 4.1 `cd src/Triviador.Client && npx tsc -b --noEmit` passes (CSS-only change, expected no-op)
- [x] 4.2 `cd src/Triviador.Client && npm run build` passes
