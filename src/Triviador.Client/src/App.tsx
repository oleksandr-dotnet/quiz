import { useEffect } from 'react'
import './App.css'
import { ensureConnected } from './api/connection'
import { joinRoom } from './api/commands'
import { useGameStore } from './store/gameStore'
import { LandingScreen } from './screens/LandingScreen'
import { LobbyScreen } from './screens/LobbyScreen'

function urlRoomCode(): string | null {
  const match = /^#\/room\/([A-Za-z0-9]{4})/.exec(window.location.hash)
  return match ? match[1].toUpperCase() : null
}

function App() {
  const status = useGameStore((s) => s.status)
  const session = useGameStore((s) => s.session)
  const view = useGameStore((s) => s.view)
  const applyView = useGameStore((s) => s.applyView)
  const setSession = useGameStore((s) => s.setSession)

  const urlCode = urlRoomCode()
  const sessionUsable = session !== null && (!urlCode || urlCode === session.roomCode)

  useEffect(() => {
    void ensureConnected()
  }, [])

  useEffect(() => {
    if (status !== 'connected' || !sessionUsable || !session) return
    const name = localStorage.getItem('triviador.name') ?? ''
    joinRoom(session.roomCode, name, session.playerToken).then((result) => {
      if (result.success && result.view) {
        applyView(result.view)
      } else {
        setSession(null)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sessionUsable])

  if (!sessionUsable || !view) return <LandingScreen />
  return <LobbyScreen />
}

export default App
