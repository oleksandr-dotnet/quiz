import { motion } from 'motion/react'
import { SEAT_COLORS } from '../../lib/seats'

const MAX_BASE_HIT_POINTS = 5 // matches GameRules.BaseHitPointsDefault

export interface WaxSealProps {
  x: number
  y: number
  seat: number
  hitPoints: number | null
  monogram: string
}

// A wax seal marks a base region: a radial-gradient disc in the owner's colour, an embossed
// monogram, and hit points shown as pips around the rim that go hollow as HP drains.
export function WaxSeal({ x, y, seat, hitPoints, monogram }: WaxSealProps) {
  const color = SEAT_COLORS[seat % SEAT_COLORS.length]
  const hp = hitPoints ?? 0
  const pipAngles = Array.from({ length: MAX_BASE_HIT_POINTS }, (_, i) => (i / MAX_BASE_HIT_POINTS) * 2 * Math.PI - Math.PI / 2)

  return (
    <motion.g
      transform={`translate(${x} ${y})`}
      className="wax-seal"
      pointerEvents="none"
      initial={{ scale: 0, rotate: -12 }}
      animate={{ scale: 1, rotate: 0 }}
      exit={{ scale: 0, rotate: 8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 14 }}
    >
      <circle r={15} fill="url(#wax-seal-gradient)" stroke={color} strokeWidth={2} />
      <text x={0} y={4} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--paper-050)" aria-hidden="true">
        {monogram}
      </text>
      {/* The capital's crown: marks this seat's base region apart from ordinary owned territory. */}
      <g transform="translate(0 -30)" aria-hidden="true">
        <path
          d="M -9,5 L -9,1.5 L -6,-6 L -3,1.5 L 0,-6 L 3,1.5 L 6,-6 L 9,1.5 L 9,5 Z"
          fill="var(--gilt-500)"
          stroke="var(--ink-700)"
          strokeWidth={1}
          strokeLinejoin="round"
        />
        <circle cx={-6} cy={-6} r={1.3} fill="#c24b3e" />
        <circle cx={0} cy={-6} r={1.3} fill="#c24b3e" />
        <circle cx={6} cy={-6} r={1.3} fill="#c24b3e" />
      </g>
      {pipAngles.map((angle, i) => {
        const px = Math.cos(angle) * 20
        const py = Math.sin(angle) * 20
        const filled = i < hp
        return (
          <circle
            key={i}
            cx={px}
            cy={py}
            r={2.6}
            fill={filled ? 'var(--gilt-500)' : 'var(--paper-050)'}
            stroke="var(--ink-700)"
            strokeWidth={1}
          />
        )
      })}
    </motion.g>
  )
}
