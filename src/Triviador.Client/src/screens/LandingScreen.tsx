import { useState } from 'react'
import { createRoom, joinRoom } from '../api/commands'
import { useGameStore } from '../store/gameStore'
import type { JoinResult } from '../api/contracts'

function urlRoomCode(): string | null {
  const match = /^#\/room\/([A-Za-z0-9]{4})/.exec(window.location.hash)
  return match ? match[1].toUpperCase() : null
}

export function LandingScreen() {
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('triviador.name') ?? '')
  const [joinCode, setJoinCode] = useState(() => urlRoomCode() ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const setSession = useGameStore((s) => s.setSession)
  const applyView = useGameStore((s) => s.applyView)

  function handleResult(result: JoinResult) {
    if (!result.success || !result.view || !result.roomCode || !result.playerToken) {
      setError(result.rejectionReason ?? 'Something went wrong.')
      setBusy(false)
      return
    }
    localStorage.setItem('triviador.name', displayName.trim())
    setSession({ roomCode: result.roomCode, playerToken: result.playerToken })
    applyView(result.view)
  }

  async function onCreate() {
    if (!displayName.trim()) {
      setError('Enter a name first.')
      return
    }
    setBusy(true)
    setError(null)
    handleResult(await createRoom(displayName.trim(), 0))
  }

  async function onPlayVsBots() {
    if (!displayName.trim()) {
      setError('Enter a name first.')
      return
    }
    setBusy(true)
    setError(null)
    handleResult(await createRoom(displayName.trim(), 3))
  }

  async function onJoin() {
    if (!displayName.trim() || joinCode.trim().length !== 4) {
      setError('Enter a name and a 4-character room code.')
      return
    }
    setBusy(true)
    setError(null)
    handleResult(await joinRoom(joinCode.trim().toUpperCase(), displayName.trim(), null))
  }

  return (
    <main className="landing">
      <h1>Triviador</h1>
      <input
        placeholder="Your name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        maxLength={20}
      />
      <div className="landing-actions">
        <button onClick={onCreate} disabled={busy}>
          Create room
        </button>
        <button onClick={onPlayVsBots} disabled={busy}>
          Play vs 3 bots
        </button>
      </div>
      <div className="landing-join">
        <input
          placeholder="Room code"
          value={joinCode}
          maxLength={4}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
        />
        <button onClick={onJoin} disabled={busy}>
          Join
        </button>
      </div>
      {error && <p className="landing-error">{error}</p>}
    </main>
  )
}
