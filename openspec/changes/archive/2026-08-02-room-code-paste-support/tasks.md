## 1. Paste handling

- [x] 1.1 In `LandingScreen.tsx`, add an `onPaste` handler on each room-code cell input that reads
      `e.clipboardData.getData('text')`, strips non-alphanumeric characters, uppercases it, and
      (if non-empty) prevents the default paste, distributes the characters into `joinCode` starting
      at the pasted-into cell index, and focuses the first empty cell afterward (or blurs/leaves
      focus on the last cell if all four end up filled).
- [x] 1.2 Leave the existing `onCodeCellChange`/`onCodeCellKeyDown` single-character behavior
      untouched.

## 2. Verification

- [x] 2.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [x] 2.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [x] 2.3 Against the running dev server, use Playwright to paste a 4-character string into the
      first room-code cell and confirm all four cells fill correctly; verify pasting into a middle
      cell fills from that cell forward; verify single-character typing still works unchanged.
      (Verified: pasted "ab12" into cell 1 -> all four cells filled "A","B","1","2". Pasted "xy"
      into cell 2 (fresh reload) -> cells 2/3 filled "X","Y", cells 1/4 unchanged, focus moved to
      cell 4. Reloaded again and typed "Z" into cell 1 -> filled and auto-advanced focus to cell 2,
      confirming existing single-character behavior is untouched. Zero console errors throughout.)
