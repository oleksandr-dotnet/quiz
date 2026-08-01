import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

// The `--dur-*` CSS custom properties handle reduced-motion for CSS transitions/keyframes on their
// own (zeroed globally in theme/tokens.css), but `motion`-driven transitions (AnimatePresence
// variants, spring physics) take their durations as plain numbers in JS and have no such shared
// source - this hook is that source for motion-driven code, so a `motion` transition can be
// disabled the same way a CSS one already is, without every call site hand-rolling its own
// matchMedia listener.
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [])

  return reduced
}
