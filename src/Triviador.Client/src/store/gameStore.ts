import { create } from 'zustand'
import type { GameView, RoomView } from '../api/contracts'
import { EMPTY_MATCH_LOG, updateMatchLog, type MatchLog } from '../lib/recap'

type Status = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed'

interface Session {
  roomCode: string
  playerToken: string
  // Set only by the /test-mechanics playground's room creation - lets App.tsx render
  // SandboxControlPanel without any server round trip, and survives a page refresh alongside the
  // rest of the session since it's persisted in the same sessionStorage blob.
  isSandbox?: boolean
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
  // Whole-match recap bookkeeping (see lib/recap.ts) - accumulated snapshot by snapshot for the
  // life of one match, not just the transient per-render transitions useGameTransitions derives.
  matchLog: MatchLog
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
  matchLog: EMPTY_MATCH_LOG,
  setStatus: (status) => set({ status }),
  applyView: (view) => set({ view }),
  // The previous snapshot is kept alongside the new one so useGameTransitions can diff
  // (previous, current) to derive what changed - the server only ever broadcasts full snapshots,
  // never a delta/event channel. matchLog folds the same diff into a persistent, whole-match
  // recap history (see lib/recap.ts), not just the transient per-render transitions the hook uses.
  applyGameView: (gameView) => {
    const previousGameView = get().gameView
    set({ previousGameView, gameView, matchLog: updateMatchLog(get().matchLog, gameView, previousGameView) })
  },
  setSession: (session) => {
    saveSession(session)
    set({ session })
  },
  // A self-initiated leave, distinct from roomClosed/kicked: no banner reason to show, but the
  // stale view/gameView must be cleared just the same - otherwise the next room created or joined
  // renders on top of this match's leftover snapshot until the server happens to broadcast a fresh
  // GameState (which a not-yet-started room never does), making a brand new room look like the old
  // game. matchLog resets alongside for the same reason.
  leaveGame: () => {
    saveSession(null)
    set({ session: null, view: null, gameView: null, previousGameView: null, emotesByPlayer: {}, matchLog: EMPTY_MATCH_LOG })
  },
  roomClosed: (reason) => {
    saveSession(null)
    set({
      session: null, view: null, gameView: null, previousGameView: null,
      closedReason: reason, emotesByPlayer: {}, matchLog: EMPTY_MATCH_LOG,
    })
  },
  kicked: (reason) => {
    saveSession(null)
    set({
      session: null, view: null, gameView: null, previousGameView: null,
      kickedReason: reason, emotesByPlayer: {}, matchLog: EMPTY_MATCH_LOG,
    })
  },
  receiveEmote: (playerId, emoteId) =>
    set((s) => ({
      emotesByPlayer: {
        ...s.emotesByPlayer,
        [playerId]: { emoteId, nonce: (s.emotesByPlayer[playerId]?.nonce ?? 0) + 1 },
      },
    })),
}))
