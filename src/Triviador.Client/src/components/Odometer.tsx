import { useEffect, useRef, useState } from 'react'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Rolls the displayed number from its previous value to the new one over --dur-mid, so a +400
// claim reads as a gain instead of a value silently swapping between renders. Collapses to an
// instant jump under reduced motion.
export function useAnimatedNumber(value: number, durationMs = 320): number {
  const [displayed, setDisplayed] = useState(value)
  const fromRef = useRef(value)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (value === fromRef.current) return
    if (prefersReducedMotion()) {
      fromRef.current = value
      setDisplayed(value)
      return
    }

    const from = fromRef.current
    const start = performance.now()

    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(Math.round(from + (value - from) * eased))
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
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
