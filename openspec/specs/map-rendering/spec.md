# map-rendering Specification

## Purpose
Describes how the client draws the territory board: regions as distinct abstract shapes rather than
nodes or real-world outlines, with every per-region visual state (ownership, highlights, base
markers, labels) attached to those shapes.

## Requirements

### Requirement: Regions render as distinct abstract shapes
The client SHALL render each region as a distinct, organic abstract shape (a jigsaw-piece-style
outline), not a plain circle and not a real-world geographic outline, so the assembled board reads
as a map of abstract lands of different shapes rather than a node graph or a depiction of real
geography.

#### Scenario: A region draws its abstract outline
- **WHEN** the client renders a region present in the current `GameView`
- **THEN** the region's fill area is that region's baked abstract shape path, not a circle

#### Scenario: An unmapped region degrades to the legacy circle instead of disappearing
- **WHEN** the client renders a region whose id has no entry in the client's static geometry
  dataset
- **THEN** the client falls back to drawing that region as a circle at the server-provided
  `centerX`/`centerY`/`radius`, rather than omitting the region from the board

### Requirement: Per-region visual states attach to the abstract shape
The client SHALL attach every existing per-region visual state — ownership color, eligible-to-act
highlight, contested marker, base wax seal, and its name/value label — to the region's abstract
shape and its centroid, producing the same information the circle-based rendering did.

#### Scenario: Ownership color fills the abstract shape
- **WHEN** a region has an owning player
- **THEN** that player's color renders as a wash over the region's abstract shape, not over a
  circle

#### Scenario: Base wax seal anchors to the shape's centroid
- **WHEN** a region is a player's base
- **THEN** the wax-seal marker is positioned at that region's shape centroid (or the server's
  `labelX`/`labelY` override when the client geometry dataset lacks that region), not at a
  hand-picked circle center

#### Scenario: Adjacency lines connect shape centroids
- **WHEN** the client draws an adjacency connector line between two regions
- **THEN** the line's endpoints are the two regions' shape centroids, consistent with where their
  shapes visually sit
