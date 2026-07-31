import { setSeat, leaveRoom } from '../api/commands'
import { useGameStore } from '../store/gameStore'

export function LobbyScreen() {
  const view = useGameStore((s) => s.view)
  const setSession = useGameStore((s) => s.setSession)

  if (!view) return null

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
      <button onClick={onLeave}>Leave room</button>
    </main>
  )
}
