import { create } from 'zustand'
import type { RoomView } from '../api/contracts'

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
  session: Session | null
  closedReason: string | null
  setStatus: (status: Status) => void
  applyView: (view: RoomView) => void
  setSession: (session: Session | null) => void
  roomClosed: (reason: string) => void
}

export const useGameStore = create<GameStore>((set) => ({
  status: 'idle',
  view: null,
  session: loadSession(),
  closedReason: null,
  setStatus: (status) => set({ status }),
  applyView: (view) => set({ view }),
  setSession: (session) => {
    saveSession(session)
    set({ session })
  },
  roomClosed: (reason) => {
    saveSession(null)
    set({ session: null, view: null, closedReason: reason })
  },
}))
