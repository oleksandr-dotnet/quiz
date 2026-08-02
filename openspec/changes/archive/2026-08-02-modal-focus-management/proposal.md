## Why

Both `role="dialog" aria-modal="true"` overlays in the client - `HowToPlayModal` and
`RotateDeviceGate` - have no focus management. On open, focus never moves into the dialog; Tab
cycles straight through to controls on the page behind the overlay (the landing screen's language
toggle, name input, etc., visually hidden under the dark backdrop but still in the tab order); and
on close, focus isn't returned to whatever triggered the dialog. This is a real WCAG 2.1 (2.4.3
Focus Order / 2.1.2 No Keyboard Trap counterpart - a modal needs the *opposite* trap) violation, not
a cosmetic nitpick: a keyboard or screen-reader user opening either dialog loses their place and can
interact with a screen they can't see.

## What Changes

- Add a small shared focus-trap hook: on mount, remember the previously focused element and move
  focus to the first focusable element inside the dialog (falling back to the dialog container
  itself); while mounted, Tab/Shift+Tab cycles only among the dialog's own focusable elements; on
  unmount, restore focus to the element that had it before the dialog opened.
- Apply this hook to both `HowToPlayModal` and `RotateDeviceGate`, since both already share the same
  dialog markup pattern.
- No change to game logic, rules, DTOs, or server/domain code - client-only accessibility fix.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `client-onboarding`: adds a focus-management requirement to the rules-explainer modal it already
  governs.
- `mobile-viewport-interaction`: adds the same focus-management requirement to the landscape-nudge
  dialog (`RotateDeviceGate`) it already governs.

## Impact

- Affected code: a new `src/Triviador.Client/src/hooks/useModalFocusTrap.ts`, plus
  `HowToPlayModal.tsx` and `RotateDeviceGate.tsx` wiring it in. No server, domain, or DTO changes,
  no new dependencies.
