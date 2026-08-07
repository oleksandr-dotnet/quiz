import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import type { GameView, RoomView } from './contracts'

let conn: HubConnection | null = null

// Module singleton, not a hook: React 18 StrictMode double-mounts effects in
// dev, which would double-register handlers and double-start the connection.
export function getConnection(): HubConnection {
  if (conn) return conn

  conn = new HubConnectionBuilder()
    .withUrl('/hub/game', {
      // WebSockets can't carry an Authorization header, so SignalR sends this via the query
      // string instead - Program.cs's JwtBearerEvents.OnMessageReceived accepts it only on this
      // hub path. Anonymous play (accessToken undefined) is completely unaffected.
      accessTokenFactory: () => useAuthStore.getState().accessToken ?? '',
    })
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
  conn.on('Emote', (playerId: string, emoteId: string) => store.receiveEmote(playerId, emoteId))
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

// accessTokenFactory is only consulted when the connection (re)negotiates - never per hub
// invocation - so a connection that started anonymously stays anonymous for the rest of its
// life even after authStore later gets a token from a Google sign-in. Call this right after a
// successful sign-in (before creating/joining a room) so the hub handshake actually carries the
// new token; a no-op-safe stop+start rather than a bespoke "upgrade" path, since SignalR has no
// API to swap a live connection's auth mid-flight.
export async function reauthenticate(): Promise<void> {
  const connection = getConnection()
  if (connection.state !== 'Disconnected') {
    await connection.stop()
  }
  useGameStore.getState().setStatus('connecting')
  await connection.start()
  useGameStore.getState().setStatus('connected')
}
