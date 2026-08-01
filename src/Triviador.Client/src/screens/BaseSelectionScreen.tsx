import { useState } from 'react'
import { selectBase } from '../api/commands'
import { useGameStore } from '../store/gameStore'
import { useCountdown } from '../hooks/useCountdown'
import type { GameView } from '../api/contracts'

export const SEAT_COLORS = ['#e05252', '#4c8bf5', '#3cb371', '#e0a030']

export function colorForPlayer(view: GameView, playerId: string | null): string {
  if (!playerId) return '#3a3a3a'
  const player = view.players.find((p) => p.playerId === playerId)
  return player ? SEAT_COLORS[player.seat % SEAT_COLORS.length] : '#666'
}

export function BaseSelectionScreen() {
  const view = useGameStore((s) => s.gameView)
  const [pickError, setPickError] = useState<string | null>(null)
  const remainingMs = useCountdown(view?.deadlineUtc ?? null)

  if (!view) return null

  const currentPicker = view.players.find((p) => p.playerId === view.currentPickerPlayerId)

  async function onPick(regionId: string) {
    if (!view!.youAreCurrentPicker) return
    setPickError(null)
    try {
      await selectBase(regionId)
    } catch (err) {
      setPickError(err instanceof Error ? err.message : 'That pick was rejected.')
    }
  }

  return (
    <main className="base-selection">
      <h1>Picking bases</h1>
      <p className="turn-banner">
        {view.youAreCurrentPicker
          ? 'Your turn - click a region to claim it as your base'
          : `Waiting for ${currentPicker?.displayName ?? (currentPicker?.isBot ? 'a bot' : 'a player')} to pick`}{' '}
        ({Math.ceil(remainingMs / 1000)}s)
      </p>
      {pickError && <p className="landing-error">{pickError}</p>}
      <svg viewBox={view.mapViewBox} className="map">
        {view.regions.map((region) => (
          <path
            key={region.regionId}
            d={region.renderPath}
            fill={colorForPlayer(view, region.ownerPlayerId)}
            fillOpacity={region.ownerPlayerId ? 0.85 : 0.25}
            stroke="#1b1b1b"
            strokeWidth={region.isBase ? 3 : 1}
            className={view.youAreCurrentPicker && !region.ownerPlayerId ? 'region selectable' : 'region'}
            onClick={() => onPick(region.regionId)}
          >
            <title>
              {region.regionId} ({region.value}pts){region.isBase ? ' - base' : ''}
            </title>
          </path>
        ))}
      </svg>
      <PlayerList view={view} />
    </main>
  )
}

function PlayerList({ view }: { view: GameView }) {
  return (
    <ul className="player-list">
      {view.players.map((p) => (
        <li key={p.playerId}>
          {p.displayName ?? (p.isBot ? 'Bot' : 'Player')} - base: {p.baseRegionId ?? 'not picked yet'}
        </li>
      ))}
    </ul>
  )
}
