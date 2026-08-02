## 1. "Your turn" derivation and title effect

- [x] 1.1 In `App.tsx`, add a pure helper `isYourTurn(view: GameView): boolean` returning true when
      `view.youAreCurrentPicker`, or `view.pendingAttackTarget?.currentAttackerPlayerId ===
      view.youPlayerId`, or (`view.pendingQuestion` exists and
      `pendingQuestion.participantPlayerIds.includes(view.youPlayerId)` and
      `!pendingQuestion.hasAnswered[view.youPlayerId]`).
- [x] 1.2 Add a `useEffect` that sets `document.title` to the translated `app.yourTurnTitle` string
      when `gameView` exists, `gameView.phase !== 'Finished'`, and `isYourTurn(gameView)` is true;
      otherwise sets it to the translated `app.title`. Clean up by resetting to `app.title` on
      unmount.
- [x] 1.3 Add translation keys `app.yourTurnTitle` to `en.json`/`ru.json`.

## 2. Verification

- [x] 2.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [x] 2.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [x] 2.3 Against the running dev server, use Playwright to drive a bots game and confirm
      `document.title` reads the "Your turn!" variant exactly when the viewer has a pending pick or
      unanswered question, and reverts to the plain title once answered/not their turn; confirm the
      title is plain on the landing screen.
      (Verified: landing screen title was plain "Triviador". Starting a bots game immediately
      flipped the tab title to "Ваш ход! · Triviador" during base selection (first picker); after
      picking, title reverted to plain while waiting on bots. Once land grab produced a Choice
      question with the viewer unanswered, the title was already back to "Your turn" without any
      extra wiring needed (same effect, same `pendingQuestion` branch); answering it immediately
      reverted the title to plain. Zero console errors throughout.)
