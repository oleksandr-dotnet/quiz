## Why

A first-time visitor to the landing screen sees only a name field and Create/Join/Play-vs-bots
buttons - there is zero in-app explanation of how the game works anywhere in the client. Standard
casual multiplayer games (Kahoot, Jackbox, and similar) all surface a lightweight rules explainer
before or during first play; this game currently has none, which is a real onboarding gap for
anyone joining without an existing player explaining the rules to them.

## What Changes

- Add a "How to play" button on the landing screen that opens a themed modal overlay (matching the
  existing `RotateDeviceGate` pattern: `role="dialog" aria-modal="true"`, a `.paper-card`-style
  card).
- The modal summarizes the four phases in plain language: picking a base, land grab (answer trivia
  to claim territory), battle (duels over regions, assaults on enemy bases), and the win condition
  (last player standing, or highest score at the round limit).
- Dismissible via a visible close button and the Escape key.
- Fully localized (English and Russian), consistent with every other client string.
- No change to game logic, rules, DTOs, or server/domain code - client-only presentation addition.

## Capabilities

### New Capabilities
- `client-onboarding`: The client's obligation to make a rules explainer discoverable and readable
  from the landing screen before a player starts or joins a game.

### Modified Capabilities
(none)

## Impact

- Affected code: `src/Triviador.Client/src` only - a new modal component, its wiring into
  `LandingScreen.tsx`, and new locale entries in `en.json`/`ru.json`. No server, domain, or DTO
  changes.
- No new dependencies.
