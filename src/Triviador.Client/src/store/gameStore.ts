import { create } from 'zustand'
import type { GameView, RoomView } from '../api/contracts'

type Status = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed'

interface Session {
  roomCode: string
  playerToken: string
}

const SESSION_KEY = 'triviador.session'

function loadSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

function saveSession(session: Session | null) {
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else sessionStorage.removeItem(SESSION_KEY)
}

interface GameStore {
  status: Status
  view: RoomView | null
  gameView: GameView | null
  previousGameView: GameView | null
  session: Session | null
  closedReason: string | null
  setStatus: (status: Status) => void
  applyView: (view: RoomView) => void
  applyGameView: (view: GameView) => void
  setSession: (session: Session | null) => void
  roomClosed: (reason: string) => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  status: 'idle',
  view: null,
  gameView: null,
  previousGameView: null,
  session: loadSession(),
  closedReason: null,
  setStatus: (status) => set({ status }),
  applyView: (view) => set({ view }),
  // The previous snapshot is kept alongside the new one so useGameTransitions can diff
  // (previous, current) to derive what changed - the server only ever broadcasts full snapshots,
  // never a delta/event channel.
  applyGameView: (gameView) => set({ previousGameView: get().gameView, gameView }),
  setSession: (session) => {
    saveSession(session)
    set({ session })
  },
  roomClosed: (reason) => {
    saveSession(null)
    set({ session: null, view: null, gameView: null, previousGameView: null, closedReason: reason })
  },
}))
