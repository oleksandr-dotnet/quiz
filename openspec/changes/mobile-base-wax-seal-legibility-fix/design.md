## Context

`GameMap.tsx` renders inside a fixed `viewBox` (`view.mapViewBox`, the server's 1200x640 layout)
that letterboxes to fit `.shell-map`'s CSS box. At the mobile breakpoint, `.shell-map`'s own
`max-height: clamp(9rem, 50vw, 16rem)` intentionally sizes that box close to the viewBox's natural
aspect ratio at the shell's available width - measured at 192-207px tall across the three target
devices, which is not itself a bug (see that rule's own comment about the blank-gap problem it
prevents). Because the map's CSS width is already the shell's near-full available width, that
height cap is width-bound, not the other way around: giving the map row more `max-height` would not
make the rendered map (or anything drawn inside it) any physically bigger, since the SVG's
`preserveAspectRatio` default (`xMidYMid meet`) settles on whichever dimension is more constraining,
and width already is.

`WaxSeal.tsx` draws its disc, monogram, crown, and hit-point pips at fixed SVG-unit sizes (15-unit
disc radius, 2.6-unit pip radius) against that same 1200-unit-wide viewBox. At the map's mobile
render scale (~0.3 CSS px per SVG unit, measured), that works out to a ~13x17 CSS px marker - too
small to read its pips during play. `ValueBadge` (the per-region cost shield) had exactly this
problem and was already fixed for the mobile breakpoint via a CSS `transform: scale()` on its
`<path>`/`<text>` leaves; `WaxSeal` was the one marker that didn't get the same treatment, likely
because seeing it requires actually reaching Battle's target-selection state, not just Base
Selection or Land Grab.

## Goals / Non-Goals

- Goal: make the wax seal's disc and hit-point pips individually legible at the map's existing
  mobile render scale.
- Goal: zero risk to the map's own layout/sizing budget - this only changes how big one marker draws
  within the map box the layout system already allocates.
- Non-goal: reclaim the empty vertical space below the target-selection card - that's a separate,
  higher-risk layout question (see proposal.md's "Known issue" section) deliberately left for a
  future change.
- Non-goal: change the map's viewBox, its `preserveAspectRatio`, or any other marker's size.

## Decision

Wrap the seal's inner visual content in a third-level `<g className="wax-seal-visual">` and CSS
`transform: scale(1.8)` it at the mobile breakpoint, with `transform-box: fill-box; transform-origin:
center` - the exact pattern already established by `.value-badge`.

The extra wrapping level exists because both of `WaxSeal.tsx`'s existing groups already carry their
own attribute-based `transform` (the outer `<g transform="translate(x y)">` positions the seal in
world space; Framer Motion's `motion.g` animates entrance scale/rotate via its own `transform`
attribute) - and per this same file's pre-existing comment, a CSS `transform` on an element that
already carries an SVG `transform` attribute *replaces* it rather than composing with it. Scaling
either existing group via CSS would silently break the seal's world position or its entrance
animation. A third group with no attribute transform of its own is the only place CSS scale can land
safely - same reasoning `.value-badge`'s own split already relies on for its leaf `<path>`/`<text>`.

1.8x was chosen empirically: it takes the measured 13x17px marker to ~23-25px across all three
target devices (confirmed live), comfortably legible without visually crowding neighboring regions
on the sampled maps (verified by screenshot - no overlap onto adjacent value badges, connectors, or
other bases' seals in any of the three device screenshots taken during verification).

Alternatives considered:
- **Relax `.shell-map`'s height cap instead.** Rejected per the Context section above: the map is
  width-bound at this breakpoint, so more height wouldn't enlarge anything drawn inside it - it would
  only add empty letterbox space, which is the "Known issue" already flagged as separate, riskier
  work.
- **Scale the whole `<g className="wax-seal">` (outer group) via a CSS class instead of adding a
  third group.** Rejected: that element carries the attribute-based `translate(x y)` positioning a
  CSS transform would clobber, exactly the hazard the file's own comment warns about.
