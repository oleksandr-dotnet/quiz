import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useGameStore } from '../store/gameStore'
import type { GameView, RoomView } from './contracts'

let conn: HubConnection | null = null

// Module singleton, not a hook: React 18 StrictMode double-mounts effects in
// dev, which would double-register handlers and double-start the connection.
export function getConnection(): HubConnection {
  if (conn) return conn

  conn = new HubConnectionBuilder()
    .withUrl('/hub/game')
    .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
    .configureLogging(LogLevel.Warning)
    .build()

  const store = useGameStore.getState()
  conn.on('State', (view: RoomView) => store.applyView(view))
  conn.on('GameState', (view: GameView) => store.applyGameView(view))
  conn.on('RoomClosed', (reason: string) => store.roomClosed(reason))
  conn.on('Kicked', (reason: string) => {
    store.kicked(reason)
    conn?.stop()
  })
  conn.onreconnecting(() => store.setStatus('reconnecting'))
  conn.onreconnected(() => store.setStatus('connected'))
  conn.onclose(() => store.setStatus('closed'))

  return conn
}

export async function ensureConnected(): Promise<void> {
  const connection = getConnection()
  if (connection.state === 'Disconnected') {
    useGameStore.getState().setStatus('connecting')
    await connection.start()
    useGameStore.getState().setStatus('connected')
  }
}
