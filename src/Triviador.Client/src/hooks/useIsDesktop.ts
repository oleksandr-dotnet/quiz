import { useEffect, useState } from 'react'

// Mirrors the project's one existing width breakpoint (App.css's `@media (min-width: 901px)`,
// `@media (max-width: 900px)`) so JS-driven layout decisions (which CSS alone can't make - e.g.
// which SVG viewBox to render) never disagree with the CSS breakpoint sitting right next to them.
const QUERY = '(min-width: 901px)'

export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const listener = (e: MediaQueryListEvent) => setDesktop(e.matches)
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [])

  return desktop
}
