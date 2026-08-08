import { useMemo, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence } from 'motion/react'
import i18next from '../i18n'
import { leaveRoom } from '../api/commands'
import { shareRecap } from '../api/recaps'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import { PlayerRoster } from '../components/PlayerRoster'
import { Toast } from '../components/Toast'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { playerDisplayName } from '../lib/format'
import { buildRecapPayload } from '../lib/recap'
import type { GameView } from '../api/contracts'

const SPARK_COUNT = 14

// A once-per-visit heraldic flourish (gilt sparks radiating from behind the headline plus a pair of
// banner rays either side of it) rendered only when the viewer's own player is the sole winner - see
// client-presentation's "distinct celebratory presentation" requirement. Pure CSS keyframes driven
// off randomized per-spark custom properties computed once via useMemo, so re-renders don't reshuffle
// the burst mid-animation. Renders nothing under reduced motion; the headline/standings/winner-banner
// already communicate the same outcome without it.
function WinCelebration() {
  const sparks = useMemo(
    () =>
      Array.from({ length: SPARK_COUNT }, (_, i) => {
        const baseAngle = (360 / SPARK_COUNT) * i
        const jitter = (Math.random() - 0.5) * (360 / SPARK_COUNT) * 0.6
        return {
          angle: baseAngle + jitter,
          distance: 68 + Math.random() * 42,
          delay: Math.random() * 0.25,
        }
      }),
    [],
  )

  return (
    <div className="win-celebration" aria-hidden="true">
      {sparks.map((spark, i) => (
        <span
          key={i}
          className="win-spark"
          style={
            {
              '--spark-angle': `${spark.angle}deg`,
              '--spark-distance': `${spark.distance}px`,
              '--spark-delay': `${spark.delay}s`,
            } as CSSProperties
          }
        />
      ))}
      <span className="win-banner-ray win-banner-ray-left" />
      <span className="win-banner-ray win-banner-ray-right" />
    </div>
  )
}

export function ResultsDock() {
  const { t } = useTranslation()
  const view = useGameStore((s) => s.gameView)
  const session = useGameStore((s) => s.session)
  const matchLog = useGameStore((s) => s.matchLog)
  const leaveGame = useGameStore((s) => s.leaveGame)
  const restoreSession = useAuthStore((s) => s.restoreSession)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'error'>('idle')
  const [recapUrl, setRecapUrl] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  if (!view) return null
  const currentView = view

  const winnerIds = new Set(currentView.outcome?.winnerPlayerIds ?? [])
  const isSoleWinnerForViewer = winnerIds.size === 1 && winnerIds.has(currentView.youPlayerId)

  async function onLeave() {
    try {
      await leaveRoom()
    } finally {
      // leaveGame(), not a bare setSession(null) - it also clears view/gameView, without which a
      // stale finished-game snapshot lingers in the store (see the store's own comment on why).
      leaveGame()
    }
  }

  // The recap is only ever persisted here, on explicit click - see add-shareable-game-recap's
  // "share, don't auto-save" requirement. Built entirely from data this client already legitimately
  // holds (buildRecapPayload); the POST is the first and only time any of it leaves the browser.
  async function onShareRecap() {
    if (!session) return
    setShareState('sharing')
    try {
      // The access token is short-lived (~15 min) and only ever refreshed on initial page load - a
      // real game can easily outlast that, so the in-memory token by the time Finished is reached
      // is often already expired. Refreshing right before this specific authenticated call (rather
      // than relying on whatever restoreSession() set minutes ago) is what makes SharedByUserId
      // land correctly instead of silently falling back to an anonymous share.
      await restoreSession()
      const freshAccessToken = useAuthStore.getState().accessToken
      const payload = buildRecapPayload(currentView, session.roomCode, matchLog)
      const id = await shareRecap(payload, freshAccessToken)
      if (!id) {
        setShareState('error')
        return
      }
      setRecapUrl(`${window.location.origin}/recap/${id}`)
      setShareState('idle')
    } catch {
      setShareState('error')
    }
  }

  async function onCopyRecapLink() {
    if (!recapUrl) return
    try {
      await navigator.clipboard.writeText(recapUrl)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      setCopyError(t('common.copyFailed'))
    }
  }

  const telegramShareUrl = recapUrl
    ? `https://t.me/share/url?url=${encodeURIComponent(recapUrl)}&text=${encodeURIComponent(t('results.telegramShareText'))}`
    : null

  return (
    <div className="results" data-testid="results-dock">
      <div className="winner-headline-frame">
        {isSoleWinnerForViewer && !reducedMotion && <WinCelebration />}
        <h2 className="winner-headline" data-testid="winner-celebration" data-celebrating={isSoleWinnerForViewer}>
          {outcomeHeadline(view, winnerIds)}
        </h2>
      </div>
      <PlayerRoster view={view} sort="score" showWinners={winnerIds} />
      <div className="landing-actions">
        {!recapUrl && (
          <button onClick={onShareRecap} disabled={shareState === 'sharing'} data-testid="share-recap">
            {shareState === 'sharing' ? t('results.sharingRecap') : t('results.shareRecap')}
          </button>
        )}
        <button className="primary" onClick={onLeave} data-testid="return-to-start">
          {t('results.returnToStart')}
        </button>
      </div>
      {recapUrl && (
        <div className="recap-share-result" data-testid="recap-share-result">
          <a href={recapUrl} target="_blank" rel="noreferrer" data-testid="recap-link">
            {recapUrl}
          </a>
          <div className="landing-actions">
            <button onClick={onCopyRecapLink} data-testid="copy-recap-link">
              {linkCopied ? t('common.copied') : t('results.copyRecapLink')}
            </button>
            {telegramShareUrl && (
              <a className="primary" href={telegramShareUrl} target="_blank" rel="noreferrer" data-testid="share-telegram">
                {t('results.shareViaTelegram')}
              </a>
            )}
          </div>
        </div>
      )}
      <AnimatePresence>{copyError && <Toast key="results-copy-error" message={copyError} />}</AnimatePresence>
      <AnimatePresence>
        {shareState === 'error' && <Toast key="results-share-error" message={t('results.shareRecapFailed')} />}
      </AnimatePresence>
    </div>
  )
}

function outcomeHeadline(view: GameView, winnerIds: Set<string>): string {
  if (winnerIds.size === 0) return i18next.t('results.noWinner')
  if (winnerIds.size > 1) return i18next.t('results.draw')
  const player = view.players.find((p) => winnerIds.has(p.playerId))
  return i18next.t('results.winnerHeadline', { playerName: playerDisplayName(player) })
}
