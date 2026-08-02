## Why

Continuing the live mobile audit against this project's explicit device targets (iPhone 16/17
family, OnePlus 13) turned up two more concrete overflow bugs beyond the landscape-breakpoint and
roster-name fixes already shipped:

1. **Numeric-question submit button clips past the card edge on the narrowest target width.**
   A live-captured screenshot at 393px (iPhone 16 portrait) during a `Tip` (numeric) `LandGrab`
   question shows the "Отправить" submit button rendering partly outside the question card, its
   text visibly cut off at the viewport edge. Root cause, confirmed via an isolated CSS harness
   (same served `App.css`, same markup, measured with `getBoundingClientRect`): a bare `<input
   type="number">` with no explicit sizing takes a browser-default width (~240px measured) that,
   combined with the adjacent submit button's natural width, exceeds the row's available space -
   `row.scrollWidth` (355px) measurably exceeded `row.clientWidth` (319px) before the fix.
2. **A dropped connection can clip the bottom of the game dock off-screen.** `ConnectionBadge`
   renders as a sibling *before* `AppShell` in the DOM, in normal document flow. At the mobile
   breakpoint `.app-shell` has a fixed `height: 100dvh` (by design, so the game never scrolls) -
   but the badge sitting above it in flow adds its own height on top of that 100dvh, pushing the
   combined content past the viewport. Since `html, body, #root` are `overflow: hidden` at this
   breakpoint (the existing rubber-band backstop), the excess is silently clipped rather than
   scrolled into view - meaning the bottom of the dock (the interactive controls the viewer needs
   most) could become invisible and unusable for the whole time a reconnect banner is showing.

## What Changes

- `.numeric-input-row input` gets `flex: 1 1 auto; min-width: 0; width: 100%` and `.numeric-input-row
  button` gets `flex-shrink: 0`, so the input shrinks to whatever room is left after the button
  takes its natural width, instead of both claiming their default sizes and overflowing.
- `.connection-badge` becomes a `position: fixed` overlay (centered, near the top, respecting
  `env(safe-area-inset-top)` for a notch/Dynamic Island/punch-hole camera) instead of a normal-flow
  element, so it floats above the game instead of adding height on top of the fixed-height mobile
  shell. This also means it no longer needs the mobile shell to have any special-cased spare room
  for it.
- No change to when either element appears or what triggers it - both are pure layout/positioning
  fixes.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `mobile-viewport-interaction`: strengthens the "game screen fits the viewport without scrolling"
  requirement with two new scenarios covering these exact overflow classes (a control row
  overflowing its own card, and an out-of-flow status banner pushing the fixed-height shell past
  the viewport).

## Impact

- `src/Triviador.Client/src/App.css` — `.numeric-input-row input`/`button` and `.connection-badge`
  rules changed. No component/TSX changes, no server/domain changes.
