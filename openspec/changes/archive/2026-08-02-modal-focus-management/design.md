## Context

`HowToPlayModal` and `RotateDeviceGate` both render a `role="dialog" aria-modal="true"` overlay with
no focus management. Both components are mounted unconditionally by their parents (`LandingScreen`
renders `<HowToPlayModal open={...} />` always; `App.tsx` renders `<RotateDeviceGate phase={...} />`
always) and internally `return null` when not shown - so "mounted" and "shown" are *not* the same
lifecycle moment for either component; a focus-trap effect has to key off an explicit shown/active
flag, not mount/unmount.

## Goals / Non-Goals

**Goals:**
- Move focus into a dialog when it opens, trap Tab navigation within it, and restore focus to the
  trigger on close, for both existing dialogs.
- Share one implementation rather than duplicating focus-trap logic twice.

**Non-Goals:**
- A general-purpose modal component/library adoption - the two existing dialogs keep their current
  markup and styling; only focus behavior is added.
- Click-outside-to-close or other dialog behaviors neither component currently has.

## Decisions

**A small hand-rolled hook (`useModalFocusTrap`) instead of a dependency like `focus-trap-react`.**
The behavior needed - focus first element on mount, cycle Tab at the boundaries, restore on unmount
- is about 30 lines with no edge cases exotic enough to justify a new dependency for two call sites.

**Keyed off an explicit `active` boolean, not mount/unmount.** Since neither component actually
unmounts when hidden, the hook takes an `active` parameter and its effect depends on `[active]`:
setup runs when `active` flips to `true` (by which point the dialog's JSX has already committed,
so the container ref is populated), teardown runs when it flips back to `false`.

**Focus the first focusable element, not the container.** Query
`button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])` inside the dialog's root
ref and focus the first match, falling back to the root itself (given `tabIndex={-1}`) only if the
dialog has no focusable children - not expected to happen in practice for either current dialog.

## Risks / Trade-offs

- **Query-based focusable-element detection can miss exotic custom elements.** Both current dialogs
  only contain plain `<button>`s, so this is a non-issue today; a future dialog with a more unusual
  focusable control would need the query list extended.
- **Restoring focus assumes the trigger element still exists in the DOM.** If the triggering element
  was removed while the dialog was open (not possible in either current use case), `.focus()` on a
  detached element is a silent no-op rather than an error - acceptable degradation.
