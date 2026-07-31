import { useState } from 'react'
import { setSeat, leaveRoom, startGame } from '../api/commands'
import { useGameStore } from '../store/gameStore'

const MIN_SEATS_TO_START = 2

export function LobbyScreen() {
  const view = useGameStore((s) => s.view)
  const setSession = useGameStore((s) => s.setSession)
  const [startError, setStartError] = useState<string | null>(null)

  if (!view) return null

  const occupiedCount = view.seats.filter((s) => s.isBot || s.displayName !== null).length
  const canStart = view.youAreHost && occupiedCount >= MIN_SEATS_TO_START

  async function toggleSeat(seatIndex: number, currentlyBot: boolean) {
    try {
      await setSeat(seatIndex, !currentlyBot)
    } catch {
      // Rejections (e.g. not host, seat occupied) surface as a HubException the
      // server logs; the seat list simply won't change, which is feedback enough
      // at this scope.
    }
  }

  async function onLeave() {
    await leaveRoom()
    setSession(null)
  }

  async function onStart() {
    setStartError(null)
    try {
      await startGame()
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Could not start the game.')
    }
  }

  return (
    <main className="lobby">
      <h1>Room {view.roomCode}</h1>
      <ul className="seat-list">
        {view.seats.map((seat) => (
          <li key={seat.seatIndex} className={seat.isHost ? 'seat seat-host' : 'seat'}>
            <span className="seat-name">
              {seat.isBot ? 'Bot' : seat.displayName ?? 'Open'}
              {seat.isHost && ' (host)'}
              {!seat.isBot && seat.displayName && !seat.isConnected && ' (disconnected)'}
            </span>
            {view.youAreHost && !seat.isConnected && (
              <button onClick={() => toggleSeat(seat.seatIndex, seat.isBot)}>
                {seat.isBot ? 'Open seat' : 'Fill with bot'}
              </button>
            )}
          </li>
        ))}
      </ul>
      {view.youAreHost && (
        <button onClick={onStart} disabled={!canStart}>
          Start Game{!canStart && ' (need 2+ seats filled)'}
        </button>
      )}
      {startError && <p className="landing-error">{startError}</p>}
      <button onClick={onLeave}>Leave room</button>
    </main>
  )
}
