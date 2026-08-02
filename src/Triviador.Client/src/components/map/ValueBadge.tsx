export interface ValueBadgeProps {
  x: number
  y: number
  value: number
}

// A small heraldic shield carrying the region's point value, since today `region.value` only shows
// up in a native <title> tooltip.
export function ValueBadge({ x, y, value }: ValueBadgeProps) {
  return (
    <g transform={`translate(${x} ${y - 16})`} className="value-badge" pointerEvents="none">
      <path
        d="M-11,-9 L11,-9 L11,2 C11,9 6,13 0,16 C-6,13 -11,9 -11,2 Z"
        fill="var(--paper-050)"
        stroke="var(--ink-500)"
        strokeWidth={1}
      />
      <text x={0} y={2.5} textAnchor="middle" fontSize={9} fontWeight={600} fill="var(--ink-700)" aria-hidden="true">
        {value}
      </text>
    </g>
  )
}
