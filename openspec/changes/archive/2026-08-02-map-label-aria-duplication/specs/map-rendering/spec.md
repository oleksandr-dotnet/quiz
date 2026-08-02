## ADDED Requirements

### Requirement: Decorative label/marker layers do not duplicate a region's accessible name
The client SHALL hide purely decorative layers drawn over a region (its name/value label text, and
any base-ownership marker) from the accessibility tree, since the region shape itself already
carries a complete accessible name.

#### Scenario: Region name/value text is hidden from assistive tech
- **WHEN** the map renders a region's name and value badge as a separate visual layer over the
  region shape
- **THEN** that layer is marked `aria-hidden` so a screen reader does not encounter the name/value
  a second time after the region shape's own accessible name

#### Scenario: Base markers are hidden from assistive tech
- **WHEN** the map renders a base's wax-seal ownership marker as a separate visual layer
- **THEN** that layer is marked `aria-hidden` so a screen reader does not encounter the owner's name
  a second time
