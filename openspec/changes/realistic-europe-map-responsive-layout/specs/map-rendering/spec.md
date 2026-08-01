## ADDED Requirements

### Requirement: Regions render as real-world geographic shapes
The client SHALL render each region as a recognizable real-world country outline (a geographic
shape), not a circle or other abstract marker, so the assembled board reads as a map of Europe.

#### Scenario: A region draws its country outline
- **WHEN** the client renders a region present in the current `GameView`
- **THEN** the region's fill area is that country's geographic outline (a closed path following its
  real borders), not a circle or other non-geographic shape

#### Scenario: An unmapped region degrades to the legacy circle instead of disappearing
- **WHEN** the client renders a region whose id has no entry in the client's static geography
  dataset
- **THEN** the client falls back to drawing that region as a circle at the server-provided
  `centerX`/`centerY`/`radius`, rather than omitting the region from the board

### Requirement: Per-region visual states attach to the geographic shape
The client SHALL attach every existing per-region visual state - ownership color, eligible-to-act
highlight, contested marker, base wax seal, and its name/value label - to the region's geographic
shape and its centroid, producing the same information the circle-based rendering did.

#### Scenario: Ownership color fills the country outline
- **WHEN** a region has an owning player
- **THEN** that player's color renders as a wash over the region's geographic shape, not over a
  circle

#### Scenario: Base wax seal anchors to the shape's centroid
- **WHEN** a region is a player's base
- **THEN** the wax-seal marker is positioned at that region's geographic centroid (or the server's
  `labelX`/`labelY` override when supplied), not at the old circle's center

#### Scenario: Adjacency lines connect shape centroids
- **WHEN** the client draws an adjacency connector line between two regions
- **THEN** the line's endpoints are the two regions' geographic centroids, consistent with where
  their shapes visually sit
