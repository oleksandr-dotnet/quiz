## Context

`GameMap.tsx` draws one `<svg viewBox="0 0 1200 700">` containing a sea background rect, adjacency
lines between region centers, one `<RegionShape>` per region, text labels, and wax-seal base
markers. `RegionShape.tsx` draws each region as a plain `<circle cx cy r>` plus overlay circles for
ownership wash, eligibility ring, and contested marker. All of that geometry comes from
`centerX`/`centerY`/`radius`/`labelX`/`labelY` fields on the server's `RegionDescriptor`
(`Triviador.Domain/Map/RegionDescriptor.cs`), loaded from `Data/map.json` (`id: "europe-16"`, 16
real European countries). The `map-topology` spec already anticipates "a rendering payload (an SVG
path or equivalent)" — today only the circle "equivalent" exists.

The SVG already scales fluidly (`width: 100%` + `viewBox`), so text and shapes inside it scale
together automatically once the *container* around the SVG is sized correctly. The actual gap is:
(1) the shapes are circles, not country outlines, and (2) `.app-shell` caps at `max-width: 72rem`
with a single 900px breakpoint, so viewport space beyond ~1152px (72rem) is simply unused margin —
this is what leaves a 2K monitor under-using its screen.

No mapping library (`d3`, `topojson`, `react-simple-maps`) is in `package.json` today.

## Goals / Non-Goals

**Goals:**
- Render the 16 regions as recognizable real-world country shapes, positioned geographically
  relative to each other (an actual small map of Europe), while every existing visual behavior
  (ownership color, eligibility highlight, contested marker, base wax seal, adjacency lines, labels,
  claim-wash animation) keeps working unchanged from the player's perspective.
- Make the app shell scale continuously from small phones up through 2K+ desktop widths, so the
  board visibly grows to use available space rather than capping out with dead margin.
- Keep the change entirely client-side and additive: no Domain/Application/Infrastructure/DTO
  changes, no new runtime dependency shipped to the browser.

**Non-Goals:**
- No interactive pan/zoom, no real map tile/basemap provider, no change to which 16 regions exist or
  their adjacency graph.
- Not pixel-perfect cartography — simplified/generalized country outlines (as used by standard
  low-resolution world atlases) are sufficient; the bar is "reads as Europe," not "survey-grade."
- No redesign of the dock/roster UI content, only the shell's sizing behavior.

## Decisions

### 1. Bake static SVG path data at dev time, ship zero new runtime dependencies

Add `d3-geo`, `topojson-client`, and `world-atlas` as `devDependencies` only. A one-off Node script
(`src/Triviador.Client/scripts/generate-europe-paths.mjs`) reads `world-atlas`'s 50m countries
topojson (Natural Earth data, public domain), converts to GeoJSON via `topojson-client`, filters to
the 16 ISO-3166 numeric ids this game uses, fits a `d3.geoMercator` projection to their combined
bounding box against the existing `0 0 1200 700` viewBox, and for each country emits an SVG path `d`
string (`d3.geoPath`) plus a centroid `[x, y]`. Output is committed as a static TS module,
`src/Triviador.Client/src/components/map/europeGeography.ts`, keyed by the game's own `RegionId`
strings (read from `Data/map.json`, not from the geo dataset's own naming).

**Why not a runtime geo library?** `react-simple-maps`/`d3-geo` at runtime would pull ~30-60kb into
the client bundle and re-run projection math on every load for data that never changes (the map
topology is static game content, not user data). Baking it once at dev/build time costs nothing at
runtime and keeps the "no heavy runtime deps" posture the client already has (only `react`,
`zustand`, `motion`, SignalR, i18n today).

**Alternative considered**: hand-drawing simplified country polygons by eye. Rejected — 16 countries
drawn free-hand would either take disproportionate effort to look right or would not actually read
as "real Europe," which is the explicit ask.

### 2. Region shapes render from static geography data, joined by `RegionId`; centroids replace circle centers for overlays/labels

`RegionShape.tsx` switches from `<circle>` to `<path d={geometry.path}>`. All the existing overlay
elements (ownership wash, eligibility ring, contested "X", wax seal, label anchors, adjacency line
endpoints) currently anchor on `centerX/centerY` from the server descriptor — they switch to
anchoring on the static geography dataset's centroid for that `RegionId` instead, since a
country-shaped path's true visual center rarely matches the old hand-picked circle center.
`labelX`/`labelY` from the server remain available as an override if a centroid placement collides
with a neighboring label, but the default is the computed centroid.

**Fallback for unmapped regions**: if a `RegionId` the server sends has no entry in the static
geography dataset (e.g., map content changes server-side before the client dataset is regenerated),
`RegionShape` falls back to drawing the old circle at the server's `centerX/centerY/radius`. This
is a real cross-boundary risk (client geography data and server map content are maintained/deployed
independently) rather than a hypothetical, so the fallback stays.

### 3. Responsive layout: fluid `clamp()`-based sizing plus additional breakpoints, not a full rewrite

`.app-shell`'s fixed `max-width: 72rem` becomes a `clamp()` tied to viewport width (e.g.
`clamp(72rem, 94vw, 120rem)`, exact bounds tuned during implementation), so the board keeps growing
on wide monitors instead of freezing at 1152px. The two-column grid (`minmax(0,1fr) 18rem`) becomes
`minmax(0, 1fr) minmax(16rem, 22vw)` so the dock scales with the board instead of staying pinned at a
fixed rem width. A new `min-width: 1440px` breakpoint increases gaps/padding for large desktops; the
existing `900px` breakpoint's single-column phone behavior is kept and lightly adjusted (`svh`-based
height clamp) so short landscape phones don't force excess scrolling. Because the map is an SVG with
`viewBox`, shapes/labels inside it scale automatically once the container sizing above is fixed — no
per-element responsive logic is needed inside `GameMap.tsx`.

**Alternative considered**: CSS container queries per-component. Rejected as unnecessary complexity
— the shell is one grid with two slots; viewport-level media queries plus `clamp()` cover the need
without a new browser-support surface to worry about.

## Risks / Trade-offs

- [50m Natural Earth resolution may over-simplify small countries like Luxembourg-adjacent borders
  or Denmark's islands] → acceptable for a board-game-scale map; can step up to a higher-resolution
  atlas later without touching any other layer if it looks too blocky.
- [Static geography dataset can drift from server map content if regions are ever added/removed] →
  mitigated by the circle fallback in Decision 2, and by keeping the generation script in-repo and
  documented so regenerating it is a known, cheap step.
- [Fluid `clamp()` sizing could stretch the board awkwardly on ultrawide (32:9) monitors] →
  the upper `clamp()` bound caps growth; verified visually during implementation on a 2K 16:9 target
  since that's the reported problem case.

## Open Questions

- Exact `clamp()` bounds and the large-desktop breakpoint value will be tuned by eye against a 2K
  display during implementation rather than fixed here.
