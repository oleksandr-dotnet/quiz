## Context

`mobile-base-wax-seal-legibility-fix` (archived earlier this session) scaled `.wax-seal-visual` by
1.8x at the existing `@media (max-width: 900px), (max-height: 500px)` breakpoint, calibrated against
a ~190-207px map row height measured on the three target devices in **portrait**. That breakpoint's
`(max-height: 500px)` arm also covers landscape phones, but every landscape check made so far this
session (including that fix's own verification pass) used the spec's generic example dimensions
(932x430, 975x450), not the project's three real target devices held sideways (734x343, 756x352,
~840x421 - all noticeably shorter than 430-450px).

Live measurement this session at those three real landscape sizes, reaching Battle's
target-selection state (the lightest-dock, most-map-room state, i.e. the best case):

| Device (landscape)      | Viewport | `.shell-map` height | Disc (1.8x, pre-fix) | Pip (1.8x, pre-fix) |
|--------------------------|----------|----------------------|------------------------|------------------------|
| iPhone 16                | 734x343  | 78.3px               | 7.31px                 | 1.27px                 |
| iPhone 17                | 756x352  | 82.8px               | 6.99px                 | 1.21px                 |
| OnePlus 13R               | 840x421  | 117.3px              | 9.9px                  | 1.72px                 |
| (reference) iPhone 16 portrait | 393x659 | 192.5px         | 16.24px                | 2.82px                 |
| (generic example) 932x430 | 932x430 | 173.6px              | 14.65px                | 2.54px                 |

The generic 430px-tall example lands close to the portrait reference (no fix needed), confirming the
earlier fix's verification wasn't wrong for the case it tested - it simply never tested viewports
this short. All three *real* target devices' landscape sizes are meaningfully shorter than even the
generic 430px example, because `.shell-map` is the one row in the mobile grid with no minimum height
(`minmax(0, max-content)`) - the fixed-height top bar/roster/dock rows claim their share first, and
on these shorter viewports that leaves the map (and everything scaled relative to it, including the
wax seal) with much less room than the 1.8x multiplier was calibrated for.

## Goals / Non-Goals

- Goal: restore wax-seal legibility (comparable to or better than the accepted portrait baseline) on
  this project's three real target devices' landscape orientations specifically.
- Goal: zero risk to any viewport already confirmed clean - scope the new rule tightly enough
  (`max-height: 428px`) that it does not fire for the generic 430/450px examples, portrait heights,
  or desktop.
- Goal: zero risk to the no-scroll/layout invariant - this only changes a marker's `transform: scale()`
  multiplier, not `.shell-map`'s own sizing or the grid's row budget.
- Non-goal: make the multiplier continuously proportional to the map's actual rendered height (e.g.
  via CSS container queries, which this codebase doesn't use anywhere yet). A second fixed
  breakpoint-scoped multiplier, layered the same way the base 1.8x rule already is, is consistent
  with how this file already handles the portrait/generic-landscape case and needed no new
  infrastructure.

## Decision

Add a second, narrower `@media (max-height: 428px)` block (placed after the existing breakpoint's
closing brace, matching this file's existing convention of flat, non-nested media queries - see
e.g. the standalone `@media (max-width: 460px)` block elsewhere in the same file) that overrides
`.wax-seal-visual`'s transform to `scale(4.2)`. Cascade order (both rules have equal specificity,
`0-1-0`) means the later, narrower rule wins whenever both match, i.e. exactly on these short
landscape viewports; the base 1.8x rule remains what portrait and taller-landscape viewports get.

`428px` was chosen as the cutoff specifically because it sits between the tallest real target device
(OnePlus 13R landscape, 421px) and the shortest previously-verified-clean generic example (932x430) -
confirmed via `window.matchMedia('(max-height: 428px)').matches` returning `false` at exactly 430px
and `true` at 421px.

`4.2x` was chosen empirically against the worst case (iPhone 16 landscape, needing ~4.42x to fully
match the portrait reference) while checking the least-constrained case (OnePlus 13R, needing only
~2.95x) doesn't overlap anything at the resulting larger size:

| Device (landscape) | Disc (4.2x, post-fix) | Pip (4.2x, post-fix) |
|----------------------|--------------------------|--------------------------|
| iPhone 16             | 17.06px                   | 2.96px                   |
| iPhone 17              | 18.83px                   | 3.26px                   |
| OnePlus 13R            | 23.1px                    | 4.0px                    |

All three now meet or exceed the ~16.24px/2.82px portrait reference. Screenshot-verified on all
three: no overlap onto neighboring value badges, connector lines, or other bases' seals - the map's
own footprint is unchanged (this only scales what's drawn inside the box the grid already
allocates), and the extra room the OnePlus 13R already has going in gives the largest resulting seal
the most headroom, not the least.

Alternatives considered:
- **Give `.shell-map` a minimum height at this breakpoint.** Rejected: the no-scroll invariant is the
  single most heavily-verified property in this codebase across tonight's session (multiple prior
  fixes exist specifically to preserve it); forcing the map row taller competes directly with the
  dock's own room on the exact viewports where that room is already tightest, risking reopening
  scroll on a long question/keypad. A marker-only scale change carries none of that risk.
- **A single unified multiplier across the whole existing breakpoint, replacing 1.8x.** Rejected: a
  value big enough to fix the landscape case would over-scale the seal at portrait's much larger
  ~190-207px map row, risking overlap there instead - the two cases need different multipliers, not
  one compromise value.
- **CSS container queries keyed to `.shell-map`'s actual rendered height**, making the scale
  continuous rather than two fixed steps. More robust in principle, but this codebase has no existing
  container-query usage to extend, and the two-step approach already gets every measured case at or
  above the accepted baseline - not worth the new pattern for this fix.
