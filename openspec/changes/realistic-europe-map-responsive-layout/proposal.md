## Why

The game board currently renders each of the 16 regions as a plain SVG circle positioned by
hand-picked coordinates — it reads as an abstract node graph, not a map, and gives no sense of
actually playing across Europe. Separately, the app shell has exactly one responsive breakpoint
(900px): phones get a viable single-column layout, but nothing scales up past a ~72rem board, so a
2K+ desktop monitor just shows a small board surrounded by wasted whitespace. Both are pure
presentation problems — the underlying region/adjacency graph in `Triviador.Domain` is correct and
stays the source of truth for game logic; only how the client draws and sizes it needs to change.

## What Changes

- Replace the circle-based region rendering in `GameMap.tsx`/`RegionShape.tsx` with real
  country-shaped SVG paths for all 16 regions (Spain, Portugal, France, UK, Ireland, Belgium,
  Netherlands, Germany, Switzerland, Italy, Austria, Poland, Czechia, Denmark, Sweden, Ukraine), so
  the board reads as a recognizable map of Europe rather than a graph diagram.
- Add a client-only, build-time-generated static dataset (country path `d` strings + centroids) that
  is keyed by the same `RegionId`s the domain already emits — generated once from a public-domain
  geography source via a dev-only script, committed as static data, with no new runtime dependency
  shipped to the browser bundle.
- Keep adjacency lines, labels, wax-seal base markers, claim-wash/contested overlays, and
  eligible-region highlighting working against the new shapes, driven from each shape's centroid
  instead of the old circle's `centerX`/`centerY`.
- Overhaul the app shell's CSS to scale fluidly from phone widths up through 2K+ desktop widths: the
  board grows to use available space instead of capping out with excess margin, and the phone layout
  keeps the map legible without horizontal scrolling.
- **BREAKING**: none — this is a client-only visual/layout change. No wire contract, DTO, or domain
  model changes.

## Capabilities

### New Capabilities
- `map-rendering`: the client SHALL render each region as a recognizable real-world geographic shape
  (not a circle/abstract marker), with all existing per-region visual states (ownership color,
  eligibility highlight, contested marker, base wax seal, adjacency lines, labels) attached to that
  shape.
- `responsive-layout`: the app shell SHALL adapt continuously across phone, tablet, laptop, and large
  (2K+) desktop viewports, scaling the game board to use available space rather than capping at a
  fixed max-width with unused margin.

### Modified Capabilities
- (none — `map-topology`'s existing "rendering payload (an SVG path or equivalent)" requirement is
  being fulfilled, not changed; the domain's `RegionDescriptor` shape and adjacency rules are
  untouched)

## Impact

- Affected code: `src/Triviador.Client/src/components/map/GameMap.tsx`,
  `src/Triviador.Client/src/components/map/RegionShape.tsx`, `src/Triviador.Client/src/App.css`,
  `src/Triviador.Client/src/theme/paper.css`, and a new static geography data module under
  `src/Triviador.Client/src/components/map/`.
- New dev-time-only tooling: a one-off generation script (using `d3-geo` + `topojson-client` as
  `devDependencies`) that produces the static path/centroid data; these packages are not part of the
  shipped client bundle.
- No changes to `Triviador.Domain`, `Triviador.Application`, `Triviador.Infrastructure`, or any DTO —
  `RegionId` remains the only link between game logic and the new visual dataset.
