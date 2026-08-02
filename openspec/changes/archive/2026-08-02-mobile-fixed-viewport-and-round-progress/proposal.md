## Why

On phones the game page currently scrolls, and the map supports pinch-zoom/drag-pan — both were
tuned for an old map with small, real-world-shaped regions. Since `abstract-map-rework` replaced
those with large, generically-shaped abstract regions in a fixed viewBox, the original
small-touch-target justification for zoom/pan no longer applies. The map and full game screen
should instead fit entirely on one viewport with zero scroll in any direction, on any device.
Separately, players can currently only see the *current* round number, not how many rounds remain
— a basic progress-visibility gap for a game with a fixed round limit.

## What Changes

- **BREAKING**: remove map pinch-zoom, drag-pan, and the reset-view control entirely (all
  viewports, not just mobile) — the map now renders at a fixed, non-interactive scale everywhere.
  `MapViewport.tsx` and its CSS are deleted; `GameMap` renders directly.
- **BREAKING**: remove the landscape-orientation nudge (`RotateDeviceGate`) entirely, including its
  fullscreen-lock attempt and focus-trap behavior — forcing landscape contradicts fitting the game
  on one screen held naturally.
- Rework the mobile app-shell layout (`@media (max-width: 900px)` in `App.css`) so the map, player
  roster, and phase dock together always fit within `100dvh` with no scroll, in every phase
  (`BaseSelection`, `LandGrab`, `Battle`, `Finished`) — the map is the one row that flexes to
  absorb leftover space; header and dock size to content.
- Compact the mobile player roster into a single non-wrapping row (existing name-truncation CSS
  already handles overflow-by-text).
- Add `RoundLimit` to the wire contract (`GameViewDto` → `contracts.ts`) and show
  rounds-remaining alongside the current round number in the Battle-phase top bar, with a slim
  decorative progress bar.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `mobile-viewport-interaction`: removes the pinch-zoom/drag-pan, reset-view, landscape-nudge,
  fullscreen-lock-attempt, and nudge-focus-management requirements (no longer applicable post
  `abstract-map-rework`); adds requirements that the game screen fits the viewport without
  scrolling in every phase, and that the map renders at a fixed, non-zoomable scale. The existing
  touch-target-size requirement is unchanged.
- `client-presentation`: adds a requirement that the Battle-phase round display shows rounds
  remaining (and the round limit), not just the current round number.

## Impact

- `src/Triviador.Client/src/App.css` — mobile `.app-shell`/`.shell-map`/`.game-map`/
  `.shell-roster`/`.shell-dock`/`.results` rules reworked for a fixed, non-scrolling viewport;
  `.map-viewport-*` and `.rotate-device-gate*` rules removed.
- `src/Triviador.Client/src/components/map/MapViewport.tsx` — deleted.
- `src/Triviador.Client/src/components/RotateDeviceGate.tsx` — deleted.
- `src/Triviador.Client/src/App.tsx` — drops both components' mount points; `TopBar` round display
  updated.
- `src/Triviador.Client/src/i18n/resources/en.json` / `ru.json` — remove `orientation.*` keys, add
  a round-progress key.
- `src/Triviador.Application/Contracts/GameViewDto.cs`, `src/Triviador.Application/Hosting/RoomActor.cs`
  — add `RoundLimit` to the view DTO.
- `src/Triviador.Client/src/api/contracts.ts` — add `roundLimit: number` to `GameView`.
- `openspec/specs/mobile-viewport-interaction/spec.md`, `openspec/specs/client-presentation/spec.md`
  — requirement deltas described above.
- No `Triviador.Domain` change — `GameRules.RoundLimit` already exists.
