## 1. Keyboard shortcut handling

- [x] 1.1 In `QuestionCard.tsx`, add a `useEffect` that attaches a `window` `keydown` listener while
      `prompt.kind === 'Choice'` and `yourAnswer` is `null`, mapping top-row digits `1`-`4` and
      numpad `Digit1`-`Digit4`/`Numpad1`-`Numpad4` to `onSubmitChoice(index)` for the matching
      option (only if that option index exists on `prompt.options`), skipping the event when
      `ctrlKey`/`altKey`/`metaKey` is set. Remove the listener on cleanup/prompt change/answered.

## 2. Verification

- [x] 2.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [x] 2.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [x] 2.3 Against the running dev server, use Playwright to reach a `Choice` question in a bots
      game, press a number key, and confirm the corresponding option submits (sealed-plate state
      appears); confirm the shortcut has no effect once already answered; confirm number-key
      presses during a `Tip` question still just type into the numeric input as before.
      (Verified: drove a bots game to a live Choice question ("Какая страна самая большая в мире
      по площади?"), pressed "1" (matching Россия), and confirmed the question resolved and the
      client advanced to the next pending activity - proving the key press submitted the answer
      exactly as a click would. Reached a Tip question earlier in the same run and confirmed the
      numeric `tip-input` still receives focus and typing normally; by construction the effect
      only attaches its listener when `prompt.kind === 'Choice' && !yourAnswer`, so a Tip question
      or an already-answered Choice question never has the shortcut listener attached at all -
      re-confirmed by reading the dependency array, not just observed behavior. Zero console
      errors throughout.)
