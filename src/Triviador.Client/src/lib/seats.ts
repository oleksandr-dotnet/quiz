import type { GameView } from '../api/contracts'

// Mirrors the --seat-0..3 custom properties in theme/tokens.css. Kept as literal hex values (not
// read from CSS) because SVG fill attributes need a concrete color, not a var() reference resolved
// against the DOM.
export const SEAT_COLORS = ['#a8332c', '#2f4a7a', '#3f6b43', '#a9761f']

export const UNCLAIMED_COLOR = '#ece0c4'

export function seatIndexFor(view: GameView, playerId: string | null): number | null {
  if (!playerId) return null
  const player = view.players.find((p) => p.playerId === playerId)
  return player ? player.seat % SEAT_COLORS.length : null
}

export function colorForPlayer(view: GameView, playerId: string | null): string {
  const seat = seatIndexFor(view, playerId)
  return seat === null ? '#666' : SEAT_COLORS[seat]
}

// One heraldic hatch pattern per seat - diagonal, counter-diagonal, cross-hatch, dotted - so
// territories stay distinguishable by pattern alone, not just by hue.
export function hatchPatternIdFor(seat: number): string {
  return `seat-hatch-${seat % SEAT_COLORS.length}`
}
