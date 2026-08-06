## 1. Implementation
- [x] 1.1 Add `align-content: center` to `.app-shell:has(.shell-map.hide-mobile)` in `App.css`, with
      a comment explaining why `center` (not the base rule's `start`) is safe here.

## 2. Verification
- [x] 2.1 Live Playwright audit on all three target devices (OnePlus 13R, iPhone 16, iPhone 17):
      confirm leftover space now splits above/below on OnePlus 13R, and confirm no visible change on
      iPhone 16/17 (already no leftover to redistribute).
- [x] 2.2 `npx tsc -b --noEmit` in `src/Triviador.Client` - clean.
- [x] 2.3 `dotnet build` at repo root - clean.
- [x] 2.4 `npm test` in `tests/e2e` - 16/16 passing.
