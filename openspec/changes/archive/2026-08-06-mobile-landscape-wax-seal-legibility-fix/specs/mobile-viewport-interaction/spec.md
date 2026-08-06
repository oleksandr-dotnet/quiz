## MODIFIED Requirements

### Requirement: A base's wax seal remains legible at the map's mobile-breakpoint scale
The client SHALL render a base region's wax-seal marker - its disc, monogram, and hit-point pips -
large enough to be individually distinguishable on narrow viewports, even though the map itself is
capped to a small rendered height at that breakpoint. This SHALL hold on this project's three real
target devices' landscape orientations specifically (iPhone 16 at 734x343, iPhone 17 at 756x352,
OnePlus 13R at ~840x421), not only on portrait widths or the spec's generic short-landscape examples
- the map's flexible row renders meaningfully shorter on these three real devices than either of
those, and the seal's legibility scale must keep up with it.

#### Scenario: A base's hit-point pips are individually distinguishable during target selection
- **WHEN** the map is visible on a narrow viewport (as narrow as 393px) with at least one base owned
  by an active player
- **THEN** the wax seal's hit-point pips render large enough, and far enough apart, to be counted at
  a glance rather than blurring into an indistinct dot

#### Scenario: A scaled-up wax seal does not overlap neighboring map elements
- **WHEN** a wax seal is enlarged for legibility on a narrow viewport
- **THEN** it does not visually overlap an adjacent region's value badge, connector line, or another
  base's wax seal

#### Scenario: Hit-point pips remain legible on this project's real landscape target devices
- **WHEN** the map is visible during Battle's target-selection state on one of this project's three
  real target devices held in landscape (iPhone 16 at 734x343, iPhone 17 at 756x352, OnePlus 13R at
  ~840x421), where the map's flexible row renders shorter than at portrait widths or the spec's
  generic short-landscape examples
- **THEN** the wax seal's hit-point pips and disc render at least as large as they do at the
  project's portrait baseline, rather than shrinking further along with the map row
