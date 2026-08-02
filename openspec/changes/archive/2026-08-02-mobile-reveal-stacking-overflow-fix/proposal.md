## Why

A fresh Explore-agent sweep of the client (deliberately re-scoped away from everything already
checked this session) surfaced three more concrete mobile issues, all confirmed empirically via an
isolated CSS harness (the real served `App.css`, real markup, measured with
`getBoundingClientRect`/`scrollWidth`/`scrollHeight`) rather than taken on faith:

1. **`.reveal-row`'s name/answer columns have no shrink handling.** `.reveal-name` sits in a fixed
   `8rem` grid column with no `min-width: 0`/`overflow`/`text-overflow` rule anywhere in the
   stylesheet (confirmed via grep) — the exact bug class already fixed once for
   `.player-card`/`.player-name` (see that rule's own comment), but never applied here. A longer
   player name forces the grid track wider than its content budget, overlapping the neighboring
   answer column's text. Measured before the fix: `row.scrollWidth` 327px vs `clientWidth` 319px on
   a 393px-wide phone with a moderately long custom name.
2. **LandGrab's reveal+next-question stack has no height ceiling.** `LandGrabScreen.tsx` (by
   documented design — see its own top-of-file comment) renders `RevealOverlay` and the *next*
   `QuestionCard` simultaneously for `REVEAL_VISIBLE_MS` (3s), so results and the next prompt
   coexist. When both are numeric (`Tip`) questions, the combined content (archery-target reveal +
   ranked list + numeric input + full keypad) reaches 900-1500px — far more than the mobile shell's
   fixed `100dvh` height, even with the map row shrunk to 0 (the only currently-flexible track).
   Measured before the fix: the dock's natural content height was 927-1488px against a 430-852px
   viewport across the three device sizes tested, and the screenshot showed the *next* question's
   keypad/submit button clipped off past the bottom of the viewport with no way to reach it — during
   the exact window a player needs to answer it.
3. **A dropped connection can be hidden behind the How-to-Play modal.** `.connection-badge` is
   `z-index: 50`; `.how-to-play-overlay` is `z-index: 100` with a full-viewport opaque backdrop. If
   the connection drops while a viewer has the modal open (reachable from the landing screen, before
   joining any room), the reconnect/closed banner is entirely obscured with no visual indication
   anything is wrong.

## What Changes

- Add `.reveal-name, .reveal-answer { min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; }` — same pattern already used for `.player-name`.
- Give `.shell-dock` (mobile breakpoint only) `max-height: 70dvh; overflow-y: auto;` so when a
  phase's dock content is taller than that generous cap — which only the LandGrab
  reveal-plus-next-question stack ever approaches; every other already-verified dock state stays
  comfortably under it, confirmed by re-running the live audit after this change with zero
  regression — the excess becomes reachable by scrolling within the dock instead of silently
  clipped past the viewport.
- Raise `.connection-badge`'s `z-index` from 50 to 200, above every other overlay in the stylesheet
  (the how-to-play modal is the highest at 100), so a dropped connection is never hidden behind a
  dialog.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `mobile-viewport-interaction`: strengthens the "game screen fits the viewport without scrolling"
  requirement with scenarios covering a reveal-row's name/answer columns and the LandGrab
  reveal-plus-next-question stack specifically.

## Impact

- `src/Triviador.Client/src/App.css` — `.reveal-name`/`.reveal-answer`, `.shell-dock`, and
  `.connection-badge` rules changed. No component/TSX changes, no server/domain changes.
