## 1. HowToPlayModal component

- [x] 1.1 Create `src/Triviador.Client/src/components/HowToPlayModal.tsx`: a `role="dialog"
      aria-modal="true"` overlay (matching `RotateDeviceGate`'s markup pattern) rendered only when
      an `open` prop is true, taking `onClose: () => void`.
- [x] 1.2 Body content: four short sections (base selection, land grab, battle, win condition),
      each a heading + one or two sentences, all text via `useTranslation`.
- [x] 1.3 A visible close button that calls `onClose`.
- [x] 1.4 An effect that listens for `Escape` while `open` is true and calls `onClose`, removing
      the listener on close/unmount.

## 2. Wire into the landing screen

- [x] 2.1 In `LandingScreen.tsx`, add local `howToPlayOpen` state, a "How to play" button near the
      brand/tagline that sets it true, and render `<HowToPlayModal open={howToPlayOpen}
      onClose={() => setHowToPlayOpen(false)} />`.
- [x] 2.2 Add translation keys under a `howToPlay.*` namespace (button label, modal title, four
      phase headings/bodies, close button) to both `en.json` and `ru.json`.
- [x] 2.3 Add CSS for the modal overlay/card, reusing `.rotate-device-gate`-style overlay
      positioning and `.paper-card` surface conventions rather than inventing new tokens.

## 3. Verification

- [x] 3.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [ ] 3.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [x] 3.3 Against the running dev server, use Playwright to open the landing screen, click "How to
      play", confirm the modal renders with all four phase sections, close it via the close button,
      reopen it and close it via Escape, and confirm the landing screen underneath remains fully
      usable (name field/buttons still work) after each close.
      (Verified: opened via the "How to play?" button, screenshotted the four-section card, closed
      via the × button (landing screen still interactive after), reopened, closed via Escape,
      zero console errors, then switched to Russian and confirmed the button label, dialog title,
      and all four section headings/bodies render in Russian.)
