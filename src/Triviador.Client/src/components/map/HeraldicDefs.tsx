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
