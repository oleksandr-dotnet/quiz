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

interface EmoteEvent {
  emoteId: string
  nonce: number
}

interface GameStore {
  status: Status
  view: RoomView | null
  gameView: GameView | null
  previousGameView: GameView | null
  session: Session | null
  closedReason: string | null
  kickedReason: string | null
  // Latest emote per sender, keyed by playerId - a re-send from the same player bumps `nonce` so a
  // listener can re-trigger its own bubble animation even when the emoteId itself repeats.
  emotesByPlayer: Record<string, EmoteEvent>
  setStatus: (status: Status) => void
  applyView: (view: RoomView) => void
  applyGameView: (view: GameView) => void
  setSession: (session: Session | null) => void
  leaveGame: () => void
  roomClosed: (reason: string) => void
  kicked: (reason: string) => void
  receiveEmote: (playerId: string, emoteId: string) => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  status: 'idle',
  view: null,
  gameView: null,
  previousGameView: null,
  session: loadSession(),
  closedReason: null,
  kickedReason: null,
  emotesByPlayer: {},
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
  // A self-initiated leave, distinct from roomClosed/kicked: no banner reason to show, but the
  // stale view/gameView must be cleared just the same - otherwise the next room created or joined
  // renders on top of this match's leftover snapshot until the server happens to broadcast a fresh
  // GameState (which a not-yet-started room never does), making a brand new room look like the old
  // game.
  leaveGame: () => {
    saveSession(null)
    set({ session: null, view: null, gameView: null, previousGameView: null, emotesByPlayer: {} })
  },
  roomClosed: (reason) => {
    saveSession(null)
    set({ session: null, view: null, gameView: null, previousGameView: null, closedReason: reason, emotesByPlayer: {} })
  },
  kicked: (reason) => {
    saveSession(null)
    set({ session: null, view: null, gameView: null, previousGameView: null, kickedReason: reason, emotesByPlayer: {} })
  },
  receiveEmote: (playerId, emoteId) =>
    set((s) => ({
      emotesByPlayer: {
        ...s.emotesByPlayer,
        [playerId]: { emoteId, nonce: (s.emotesByPlayer[playerId]?.nonce ?? 0) + 1 },
      },
    })),
}))
