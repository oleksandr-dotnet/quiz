import { useMemo } from 'react'
import type { GameView } from '../api/contracts'
import { deriveGameTransitions, type GameTransition } from '../lib/gameTransitions'

export type { GameTransition }

export function useGameTransitions(current: GameView | null, previous: GameView | null): GameTransition[] {
  return useMemo(() => deriveGameTransitions(current, previous), [current, previous])
}
