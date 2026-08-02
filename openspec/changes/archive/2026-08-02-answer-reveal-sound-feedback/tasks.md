## 1. Sound module

- [x] 1.1 Create `src/Triviador.Client/src/lib/sound.ts`: a lazily-constructed module-level
      `AudioContext`, a `tone(freq, startOffset, duration, type, gain)` helper building an
      oscillator + gain-envelope pair, and exported `playCorrect()` (a short ascending 2-3 note
      chime) and `playIncorrect()` (a short descending buzz).
- [x] 1.2 Add `isMuted()`/`setMuted(next: boolean)` backed by a `triviador.muted` `localStorage`
      key, defaulting to unmuted (`false`) when unset. `tone()` SHALL no-op immediately when muted.

## 2. Mute toggle

- [x] 2.1 Create `src/Triviador.Client/src/components/MuteToggle.tsx`: a button showing a
      speaker/muted-speaker glyph, toggling `setMuted`, with a translated `aria-label` that reflects
      current state.
- [x] 2.2 Add translation keys (`sound.mute`, `sound.unmute`) to `en.json`/`ru.json`.
- [x] 2.3 Render `<MuteToggle />` in `TopBar` (`App.tsx`), visible throughout gameplay.

## 3. Wire reveal cues

- [x] 3.1 In `RevealOverlay.tsx`, add a `useEffect` keyed on `prompt.questionId` that finds the
      viewer's own row in `ranked` (by `view.youPlayerId`), and calls `playCorrect()`/
      `playIncorrect()` based on that row's `correct`/`answer.kind` exactly once per question (no
      call when the viewer's `answer.kind === 'None'`).

## 4. Verification

- [x] 4.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [x] 4.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [x] 4.3 Against the running dev server, use Playwright to monkey-patch
      `AudioContext.prototype.createOscillator` to count calls, drive a bots game to a reveal, and
      confirm oscillators were created (a cue played) for a resolved question; toggle mute and
      confirm the next reveal creates zero oscillators; confirm the mute preference survives a page
      reload; confirm zero console errors throughout.
      (Verified: unmuted, drove a bots game through two land-grab reveals and confirmed 6
      oscillators were created (two 3-tone chimes). Clicked the mute toggle (localStorage
      `triviador.muted` -> "true"), reset the counter, and confirmed a subsequent reveal - visibly
      showing a correct ✓ answer in the ranked list - created zero oscillators. Reloaded the page
      and confirmed the toggle still read muted (🔇), proving the preference persisted. Zero
      console errors throughout. Left the app unmuted afterward.)
