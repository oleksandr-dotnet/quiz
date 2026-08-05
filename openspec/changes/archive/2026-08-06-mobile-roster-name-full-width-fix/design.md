## Context

`.player-card` in the mobile roster breakpoint lays swatch, name, HP pips, and score out as a single
non-wrapping flex row. Two earlier fixes (`mobile-roster-name-truncation-fix`,
`compact-top-roster-chips-clipping-fix`) both shrank different parts of that row to reclaim width,
but neither guaranteed `.player-name` (the one segment that legitimately needs its content to be
readable) any minimum share - it was left to take whatever the other three segments didn't need,
which measured out to 0px on all three real target devices.

## Decision

Wrap the row instead of continuing to shrink it further. `.player-card` gets `flex-wrap: wrap`;
`.player-name` gets `order: -1; flex-basis: 100%`, so it occupies its own full-width line ahead of
everything else in visual order, and swatch/HP/score/status-badges wrap to a second, still-compact
line below. This trades a small amount of extra roster height (one line) for a hard guarantee the
name gets the entire card width to itself - and the map's existing "shrinks to fit whatever's left"
behavior is exactly the mechanism already in place to absorb that.

### Alternatives considered
- **Keep shrinking swatch/HP/score further**: the numbers don't work - even removing the swatch and
  HP pips entirely only recovers ~31px against the ~49-56px a 7-8 character name needs; would also
  regress seat-color/HP-at-a-glance legibility, a larger behavior change than a CSS reflow.
- **Hide score or HP from the compact roster on the narrowest widths**: removes information rather
  than just re-laying it out; bigger scope than this fix.

## Risks

- Roster grows by ~1 line of height at the narrowest widths → less room for map/dock. Mitigated by
  the existing "map shrinks to fit" architecture (`mobile-viewport-interaction` spec's first
  requirement) which already handles exactly this kind of chrome-height growth without introducing
  scroll - verified empirically on all three target devices plus the 932x430 short-landscape case.
