import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GamePhase } from '../api/contracts'

// screen.orientation.lock is Android-Chrome-family only and isn't part of TS's standard DOM lib
// (see design.md decision 6) - this local type just describes the method so the call below can be
// made without an `any` escape hatch.
type LockableScreenOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> }

const PHONE_BREAKPOINT_QUERY = '(max-width: 900px)'
const PORTRAIT_QUERY = '(orientation: portrait)'
const GATED_PHASES: ReadonlySet<GamePhase> = new Set(['BaseSelection', 'LandGrab', 'Battle'])

export interface RotateDeviceGateProps {
  phase: GamePhase
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [query])
  return matches
}

// A dismissible nudge, not a hard gate: true orientation lock needs the Fullscreen API first and
// is unsupported in iOS Safari entirely, so the CSS overlay (with a manual dismiss) is the actual
// fix for most phone browsers - see design.md decision 6.
export function RotateDeviceGate({ phase }: RotateDeviceGateProps) {
  const { t } = useTranslation()
  const isNarrow = useMediaQuery(PHONE_BREAKPOINT_QUERY)
  const isPortrait = useMediaQuery(PORTRAIT_QUERY)
  const [dismissed, setDismissed] = useState(false)

  // Leaving portrait re-arms the nudge, so a later return to portrait (even mid-session, even
  // after a prior dismissal) prompts again rather than the dismissal silently suppressing it for
  // the rest of the session.
  useEffect(() => {
    if (!isPortrait) setDismissed(false)
  }, [isPortrait])

  if (!isNarrow || !isPortrait || !GATED_PHASES.has(phase) || dismissed) return null

  async function handleFullscreenAndRotate() {
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      return
    }
    try {
      const orientation = screen.orientation as LockableScreenOrientation
      await orientation.lock?.('landscape')
    } catch {
      // Orientation Lock API missing or rejected - silent no-op, the CSS nudge already did its job.
    }
  }

  return (
    <div className="rotate-device-gate" role="dialog" aria-modal="true">
      <div className="rotate-device-gate-card">
        <p>{t('orientation.rotateMessage')}</p>
        <div className="rotate-device-gate-actions">
          <button type="button" onClick={() => void handleFullscreenAndRotate()}>
            {t('orientation.goFullscreenAndRotate')}
          </button>
          <button type="button" onClick={() => setDismissed(true)}>
            {t('orientation.continueInPortrait')}
          </button>
        </div>
      </div>
    </div>
  )
}
