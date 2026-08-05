## Why

Live Playwright measurement at the mobile roster breakpoint (all three of this project's actual
target devices: iPhone 16 at 393px, iPhone 17 at 402px, OnePlus 13R at ~421px) found `.player-name`
rendering at a hard **0px width** in `BaseSelection`/`LandGrab` with a full 4-player roster - not
ellipsis-truncated, completely invisible. `getBoundingClientRect()` on the name span for a 7-char
name ("Tester3") returned `{width: 0}` while its natural content width (`scrollWidth`) was 49px.

This is the predictable end state of two earlier fixes pulling the same ~85px card in opposite
directions: `mobile-roster-name-truncation-fix` (2026-08-02) shrank the card's padding/gap/swatch so
short names would fit; `compact-top-roster-chips-clipping-fix` (`f1c4d7f`, 2026-08-05) then shrank
`.score`/`.hit-points` because *they* can't ellipsize, explicitly treating `.player-name`'s
ellipsis as the release valve absorbing whatever's left over. Once combined, swatch (14px) +
hit-points (17px) + score (33px) alone already total ~64px against a ~59px inner card width -
before the name gets anything - so the "release valve" had nothing left to give. This directly
violates the `mobile-viewport-interaction` spec's existing requirement that a 3-8 character player
name renders in full, with no ellipsis, at this breakpoint's narrowest widths.

## What Changes

- At the `.shell-roster` mobile breakpoint only, `.player-card` becomes `flex-wrap: wrap` and
  `.player-name` gets `order: -1; flex-basis: 100%` - the name now renders on its own full-width
  first line, with the seat swatch, HP pips, and score wrapping to a compact second line beneath it,
  instead of all four competing for space on one line. Verified on all three target devices: name
  now renders at (or within a fraction of a pixel of) its full natural content width, with no new
  document-level scroll or horizontal overflow introduced (checked at each device's portrait size
  plus the existing 932x430 short-landscape regression case).
- No JSX/component changes - CSS-only, scoped to the existing mobile breakpoint media query.

## Capabilities

### Modified Capabilities
- `mobile-viewport-interaction`: no requirement text change - this restores compliance with the
  already-existing "player-name renders in full for 3-8 char names" requirement, verified against
  the three concrete target devices instead of a generic width range.

## Impact

- `src/Triviador.Client/src/App.css` - mobile-breakpoint-only rules for `.player-card` and
  `.player-name`. No component/TSX changes, no server/domain changes.

## Known issue found but out of scope for this change

Running `npm test` in `tests/e2e` (desktop viewport, unaffected by this mobile-only CSS change)
shows 12 of 16 `room-lobby.spec.ts`/`kick-player.spec.ts` tests timing out waiting for basic Landing
elements (`display-name`, `Room code character 1`, `Leave room`) - confirmed via `git stash` to be
**pre-existing**, present identically with and without this change. This looks like a real
regression somewhere in the room-join/leave flow (not a flaky-test issue - all 12 fail the same way
on both runs) and warrants its own investigation, but is unrelated to mobile roster CSS and out of
scope here. Flagging for the next iteration.
