import { SEAT_COLORS, hatchPatternIdFor } from '../../lib/seats'

// One <pattern> per seat, rendered once and referenced by id from every region that seat owns -
// heraldic hatching (diagonal, counter-diagonal, cross-hatch, dotted) so territories stay
// distinguishable by pattern alone, not just by hue.
export function HeraldicDefs() {
  return (
    <defs>
      {SEAT_COLORS.map((color, seat) => (
        <SeatPattern key={seat} seat={seat} color={color} />
      ))}
      <radialGradient id="wax-seal-gradient" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#c24b3e" />
        <stop offset="60%" stopColor="var(--wax)" />
        <stop offset="100%" stopColor="#5e1b15" />
      </radialGradient>

      {/* Subtle per-territory fill gradient (RegionShape.tsx) - a flat wash of paint reads as a UI
          swatch, a faint lit-from-upper-left gradient reads as a piece of terrain. */}
      <radialGradient id="territory-relief" cx="38%" cy="28%" r="85%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.22} />
        <stop offset="55%" stopColor="#ffffff" stopOpacity={0} />
        <stop offset="100%" stopColor="#000000" stopOpacity={0.1} />
      </radialGradient>

      {/* Procedural grain (no image asset, no network request) clipped to whatever shape it's
          applied to via feComposite's SourceAlpha mask, then multiplied back over that shape's own
          fill - the same feTurbulence technique paper.css's body::before uses for the table surface,
          reused here so decorative "terra incognita" land (DecorativeTerritory.tsx) and territory
          fills (RegionShape.tsx) read as a textured material rather than a flat vector wash. */}
      <filter id="decorative-grain" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} seed={7} stitchTiles="stitch" result="noise" />
        <feColorMatrix
          in="noise"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.8 0.8 0.8 0 0"
          result="noiseAlpha"
        />
        <feComposite in="noiseAlpha" in2="SourceAlpha" operator="in" result="clippedNoise" />
        <feBlend in="SourceGraphic" in2="clippedNoise" mode="multiply" />
      </filter>
      <filter id="territory-grain" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency={1.1} numOctaves={2} seed={3} stitchTiles="stitch" result="noise" />
        <feColorMatrix
          in="noise"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.35 0.35 0.35 0 0"
          result="noiseAlpha"
        />
        <feComposite in="noiseAlpha" in2="SourceAlpha" operator="in" result="clippedNoise" />
        <feBlend in="SourceGraphic" in2="clippedNoise" mode="multiply" />
      </filter>
    </defs>
  )
}

function SeatPattern({ seat, color }: { seat: number; color: string }) {
  const id = hatchPatternIdFor(seat)
  switch (seat % 4) {
    case 0: // diagonal
      return (
        <pattern id={id} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={8} height={8} fill={color} fillOpacity={0} />
          <line x1={0} y1={0} x2={0} y2={8} stroke={color} strokeWidth={2.5} />
        </pattern>
      )
    case 1: // counter-diagonal
      return (
        <pattern id={id} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <rect width={8} height={8} fill={color} fillOpacity={0} />
          <line x1={0} y1={0} x2={0} y2={8} stroke={color} strokeWidth={2.5} />
        </pattern>
      )
    case 2: // cross-hatch
      return (
        <pattern id={id} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={8} height={8} fill={color} fillOpacity={0} />
          <line x1={0} y1={0} x2={0} y2={8} stroke={color} strokeWidth={1.6} />
          <line x1={0} y1={0} x2={8} y2={0} stroke={color} strokeWidth={1.6} />
        </pattern>
      )
    default: // dotted
      return (
        <pattern id={id} width={7} height={7} patternUnits="userSpaceOnUse">
          <rect width={7} height={7} fill={color} fillOpacity={0} />
          <circle cx={3.5} cy={3.5} r={1.4} fill={color} />
        </pattern>
      )
  }
}
