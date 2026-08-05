## ADDED Requirements

### Requirement: A base's wax seal remains legible at the map's mobile-breakpoint scale
The client SHALL render a base region's wax-seal marker - its disc, monogram, and hit-point pips -
large enough to be individually distinguishable on narrow viewports, even though the map itself is
capped to a small rendered height at that breakpoint.

#### Scenario: A base's hit-point pips are individually distinguishable during target selection
- **WHEN** the map is visible on a narrow viewport (as narrow as 393px) with at least one base owned
  by an active player
- **THEN** the wax seal's hit-point pips render large enough, and far enough apart, to be counted at
  a glance rather than blurring into an indistinct dot

#### Scenario: A scaled-up wax seal does not overlap neighboring map elements
- **WHEN** a wax seal is enlarged for legibility on a narrow viewport
- **THEN** it does not visually overlap an adjacent region's value badge, connector line, or another
  base's wax seal
