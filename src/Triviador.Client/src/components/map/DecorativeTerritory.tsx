import type { DecorativeGeometry } from './decorativeGeography'

// Non-interactive "terra incognita" flavour land (see decorativeGeography.ts's own doc comment) -
// never clickable, never announced to assistive tech (the playable regions already carry all the
// accessible map content), purely there so the board reads as one continuous continent instead of an
// island of 18 territories in blank sea. A tiny terrain glyph per blob (not just a flat fill) is what
// keeps a dozen muted shapes from reading as empty padding around the real map.
export function DecorativeTerritory({ territory }: { territory: DecorativeGeometry }) {
  return (
    <g className={`decorative-territory decorative-${territory.terrain}`} aria-hidden="true">
      <path d={territory.path} className="decorative-fill" filter="url(#decorative-grain)" />
      <path d={territory.path} className="decorative-outline" fill="none" />
      <TerrainGlyph terrain={territory.terrain} x={territory.centroidX} y={territory.centroidY} />
    </g>
  )
}

function TerrainGlyph({ terrain, x, y }: { terrain: DecorativeGeometry['terrain']; x: number; y: number }) {
  switch (terrain) {
    case 'forest':
      return (
        <g transform={`translate(${x} ${y})`} className="terrain-glyph terrain-forest">
          <Pine dx={-14} dy={4} scale={0.85} />
          <Pine dx={2} dy={-6} scale={1.05} />
          <Pine dx={16} dy={6} scale={0.75} />
        </g>
      )
    case 'hill':
      return (
        <g transform={`translate(${x} ${y})`} className="terrain-glyph terrain-hill">
          <path d="M-22,10 C-16,-8 -4,-8 2,10 Z" />
          <path d="M-2,10 C6,-14 20,-14 26,10 Z" />
        </g>
      )
    case 'marsh':
    default:
      return (
        <g transform={`translate(${x} ${y})`} className="terrain-glyph terrain-marsh">
          <path d="M-22,-6 C-16,-11 -8,-1 -2,-6 C4,-11 12,-1 18,-6" />
          <path d="M-22,4 C-16,-1 -8,9 -2,4 C4,-1 12,9 18,4" />
          <path d="M-22,14 C-16,9 -8,19 -2,14 C4,9 12,19 18,14" />
        </g>
      )
  }
}

function Pine({ dx, dy, scale }: { dx: number; dy: number; scale: number }) {
  return (
    <path
      d="M0,-16 L7,-2 L3,-2 L9,8 L3,8 L3,16 L-3,16 L-3,8 L-9,8 L-3,-2 L-7,-2 Z"
      transform={`translate(${dx} ${dy}) scale(${scale})`}
    />
  )
}
