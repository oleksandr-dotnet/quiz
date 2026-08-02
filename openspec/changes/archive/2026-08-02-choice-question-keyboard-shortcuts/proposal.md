## Why

Every `Choice` question option already renders a numbered hint glyph (①②③④) via `QuestionCard`,
visually implying the player can press 1/2/3/4 to answer. No such keyboard handler actually exists
- the hints are purely decorative and the number keys do nothing. This is more than a missing
feature: it's a UI affordance actively promising behavior the app doesn't deliver, in a game mode
(land grab) where being first to answer correctly is the entire point, so keyboard-speed answering
is directly valuable, not just a convenience.

## What Changes

- Wire number keys 1-4 (both top-row and numpad) to submit the corresponding `Choice` option while
  a `Choice` question is pending and the viewer has not yet answered it.
- No change while a `Tip` (numeric) question is active, or once the viewer has already answered
  (the sealed-plate state) - the shortcut only ever does something the click affordance already
  allows.
- Modifier-held presses (Ctrl/Alt/Meta) are ignored so browser/OS shortcuts on the same keys are
  never intercepted.
- No change to game logic, rules, DTOs, or server/domain code - client-only input-handling
  addition.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `client-presentation`: adds a requirement that the client's own numbered-hint affordance is
  backed by actual keyboard input, not decorative-only.

## Impact

- Affected code: `src/Triviador.Client/src/components/QuestionCard.tsx` only. No server, domain,
  or DTO changes, no new dependencies.
