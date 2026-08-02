import { useEffect, useRef, useState } from 'react'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Rolls the displayed number from its previous value to the new one over --dur-mid, so a +400
// claim reads as a gain instead of a value silently swapping between renders. Collapses to an
// instant jump under reduced motion.
export function useAnimatedNumber(value: number, durationMs = 320): number {
  const [displayed, setDisplayed] = useState(value)
  // Mirrors `displayed` on every tick (not just at natural completion) so that if a new `value`
  // arrives mid-animation, the restarted animation's origin is wherever the number currently sits
  // on screen - not a stale pre-interruption value, which used to cause a visible backward jump.
  const displayedRef = useRef(value)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (value === displayedRef.current) return
    if (prefersReducedMotion()) {
      displayedRef.current = value
      setDisplayed(value)
      return
    }

    const from = displayedRef.current
    const start = performance.now()

    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = Math.round(from + (value - from) * eased)
      displayedRef.current = next
      setDisplayed(next)
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [value, durationMs])

  return displayed
}

export function Odometer({ value, className }: { value: number; className?: string }) {
  const displayed = useAnimatedNumber(value)
  return <span className={className ? `score tabular-nums ${className}` : 'score tabular-nums'}>{displayed}</span>
}
