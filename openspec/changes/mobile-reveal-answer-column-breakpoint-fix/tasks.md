## 1. Widen the reveal-row narrow-column breakpoint

- [x] 1.1 In `src/Triviador.Client/src/App.css`, change `.reveal-row`'s narrow-column media query
      from `max-width: 420px` to `max-width: 460px`, and update the rule's comment to explain why
      (matches the project's documented ~360-450px phone range; 420px excluded a 421px-wide target
      device).

## 2. Verification

- [x] 2.1 `cd src/Triviador.Client && npx tsc -b --noEmit` passes.
- [x] 2.2 `dotnet build` passes.
- [x] 2.3 `npm test` in `tests/e2e`: 15/16 passing, 1 pre-existing flake (`kick-player.spec.ts`
      "kicking mid-game with bot takeover") confirmed unrelated via isolated retry (passes clean on
      retry, same flake observed before this change was made).
- [x] 2.4 Live Playwright audit of a Choice-question Reveal on all three target devices:
      before - OnePlus 13R answer column showed "De..."/"Ju..." (1-3 chars); iPhone 16/17 showed
      full or near-full text. After - OnePlus 13R shows full text ("Mont Blanc", "Monte Rosa"),
      iPhone 16/17 unchanged (already under both the old and new threshold). No document scroll
      introduced on any of the three (`scrollHeight === clientHeight`, matching pre-change values).
