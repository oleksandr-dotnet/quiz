## 1. App-shell / CSS no-scroll pass

- [x] 1.1 In `src/Triviador.Client/src/App.css`, inside `@media (max-width: 900px)`, change
      `.app-shell` to `grid-template-rows: auto minmax(0, 1fr) auto auto` (top|map|roster|dock),
      `height: 100dvh` (not `min-height`, not `vh`/`svh`), `overflow: hidden`
- [x] 1.2 Scoped to the same breakpoint: add `html, body, #root { height: 100%; overflow: hidden;
      overscroll-behavior: none; }` as a backstop against rubber-band/pull-to-refresh
- [x] 1.3 Add `height: 100%` to `.shell-map`/`.game-map` (today it has no height rule, which is why
      its row can't shrink); confirm the SVG's default `preserveAspectRatio` letterboxes instead of
      overflowing, and match the letterbox background to the map's sea/background token
- [x] 1.4 Convert `.shell-roster`/`.player-roster` to a non-wrapping horizontal strip
      (`flex-wrap: nowrap`, each `.player-card` gets `flex: 1 1 0; min-width: 0`)
- [x] 1.5 Drop `position: sticky; bottom: 0` from `.shell-dock` (nothing to stick against once the
      shell itself can't scroll)
- [x] 1.6 Drop `margin: 2rem auto; max-width: 32rem` from `.results` (ResultsDock) under the mobile
      breakpoint specifically

## 2. MapViewport removal

- [x] 2.1 Delete `src/Triviador.Client/src/components/map/MapViewport.tsx`
- [x] 2.2 Remove its CSS (`.map-viewport-content`, `.map-viewport-reset`) from `App.css`
- [x] 2.3 Render `<GameMap>` directly in the map slot (still wrapped in a plain non-interactive
      sizing `div` for the CSS in 1.3), removing the `MapViewport` import/usage from `App.tsx`
- [x] 2.4 Confirm no global `touch-action: none` remains anywhere that would block native
      pinch-zoom-to-read-text

## 3. RotateDeviceGate removal

- [x] 3.1 Delete `src/Triviador.Client/src/components/RotateDeviceGate.tsx`
- [x] 3.2 Remove its mount point from `App.tsx`
- [x] 3.3 Remove its CSS (`.rotate-device-gate*`) from `App.css`
- [x] 3.4 Remove its i18n keys (`orientation.*`) from `en.json` and `ru.json`
- [x] 3.5 Confirm `useModalFocusTrap` is still imported/used by `HowToPlayModal` (not orphaned)

## 4. Round-limit DTO plumbing

- [x] 4.1 Confirm `GameRules.RoundLimit` in `src/Triviador.Domain/State/GameRules.cs` needs no
      change (already exists, default 12)
- [x] 4.2 Append `int RoundLimit` as the last positional parameter on
      `src/Triviador.Application/Contracts/GameViewDto.cs`
- [x] 4.3 Pass `state.Rules.RoundLimit` as the final argument at the `new GameViewDto(...)`
      construction site in `src/Triviador.Application/Hosting/RoomActor.cs`; verify argument
      count/order compiles correctly
- [x] 4.4 Add `roundLimit: number` to `GameView` in `src/Triviador.Client/src/api/contracts.ts`
- [x] 4.5 In `TopBar` (`App.tsx`), compute `roundsRemaining = Math.max(0, view.roundLimit -
      view.currentRound)` at the point of use
- [x] 4.6 Replace the bare "Round {n}" display with a current/total/remaining format (new i18n key
      in `en.json`/`ru.json`), keeping the existing flip-animation on the current-round digit
- [x] 4.7 Add a slim `aria-hidden` progress bar beneath the round text for visual reinforcement
- [x] 4.8 Leave `BattleScreen.tsx`'s existing short "Round 4" heading unchanged (intentional
      non-duplication — see design.md)

## 5. Verification

- [x] 5.1 `npx tsc -b --noEmit` passes
- [x] 5.2 `dotnet build` passes
- [x] 5.3 Manual/Playwright screenshot check at 390×844, 360×800, and 360×640 across
      `BaseSelection`, `LandGrab`, `Battle`, and `Finished`: confirm zero scroll/overflow in any
      direction (`document.documentElement.scrollHeight <= window.innerHeight` and the width
      equivalent)
- [x] 5.4 Confirm all 4 roster chips are visible in one row at each tested viewport size
- [x] 5.5 Confirm full dock content (a 4-option choice question, and the numeric keypad) is visible
      without clipping at each tested viewport size
- [x] 5.6 Manual check: native pinch-zoom-to-read-text still works (browser-level, not app-level)
- [x] 5.7 Manual check: rotating the device to landscape no longer triggers any overlay
- [x] 5.8 Confirm round display shows correctly at round 1, mid-game, and the final round (12/12,
      0 remaining), and does not appear outside the Battle phase
