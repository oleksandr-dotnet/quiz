## 1. Shared focus-trap hook

- [x] 1.1 Create `src/Triviador.Client/src/hooks/useModalFocusTrap.ts`: a hook taking a
      `RefObject<HTMLElement>` and an `active: boolean` that, when `active` becomes true, saves
      `document.activeElement`, focuses the first focusable element inside the ref's current
      element (falling back to the element itself), attaches a `keydown` listener trapping
      Tab/Shift+Tab among the container's focusable elements, and when `active` becomes false
      removes the listener and restores focus to the saved element. (Neither dialog actually
      unmounts when hidden - both parents render them unconditionally and the dialogs
      internally `return null` - so this must key off `active`, not mount/unmount.)

## 2. Wire into both dialogs

- [x] 2.1 In `HowToPlayModal.tsx`, add a ref on the dialog root div (with `tabIndex={-1}`) and call
      `useModalFocusTrap(ref, open)`.
- [x] 2.2 In `RotateDeviceGate.tsx`, add a ref on the dialog root div (with `tabIndex={-1}`) and
      call `useModalFocusTrap(ref, shown)` where `shown` is the same condition already gating its
      `return null`.

## 3. Verification

- [x] 3.1 Run `cd src/Triviador.Client && npx tsc -b --noEmit` and fix any type errors.
- [x] 3.2 Run `cd src/Triviador.Client && npm run build` and fix any build errors.
- [x] 3.3 Against the running dev server, use Playwright to open the "How to Play" modal and confirm
      `document.activeElement` is inside the dialog immediately after opening, confirm Shift+Tab
      from the first focusable element wraps to the last (and Tab from the last wraps to the
      first), and confirm closing it returns focus to the "How to play?" button. Confirm zero
      console errors.
      (Verified: opening the modal moved focus to its only focusable element (the close button)
      immediately. Since that element is both first and last, Tab and Shift+Tab both correctly
      re-focused it rather than escaping to the language-toggle buttons behind the overlay -
      confirming the trap holds even in the single-focusable-element case. Closing via Escape
      returned focus to the "How to play?" trigger button exactly. Zero console errors. Did not
      re-verify `RotateDeviceGate` live - it uses the identical hook and pattern, only reachable
      mid-game on a narrow/portrait viewport, and is verified by tsc/build plus code symmetry with
      the live-proven `HowToPlayModal` path.)
