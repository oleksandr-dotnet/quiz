import { useEffect, useRef, useState } from 'react'
import type { GameView, LastRevealView } from '../api/contracts'

// Land grab has no RevealHold (unlike Battle): the result arrives as a one-shot `lastReveal` on the
// same snapshot as the next pick prompt, and is lost on reconnect. This keeps it visible for a
// fixed window after each arrival - shared by LandGrabDock (to render the overlay) and App.tsx (to
// know when to hide the map / suppress the next prompt on mobile) so both agree on exactly the same
// window without either one re-deriving it.
export const LAND_GRAB_REVEAL_VISIBLE_MS = 6000

export function useLandGrabReveal(view: GameView | null): LastRevealView | null {
  const [visibleReveal, setVisibleReveal] = useState<LastRevealView | null>(null)
  const revealTimeoutRef = useRef<number | null>(null)
  const lastReveal = view?.lastReveal ?? null

  useEffect(() => {
    if (!lastReveal) return
    setVisibleReveal(lastReveal)
    if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current)
    revealTimeoutRef.current = window.setTimeout(() => setVisibleReveal(null), LAND_GRAB_REVEAL_VISIBLE_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastReveal])

  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current)
    }
  }, [])

  return visibleReveal
}
