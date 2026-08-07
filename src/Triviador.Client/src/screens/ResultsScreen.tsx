import { useMemo, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence } from 'motion/react'
import i18next from '../i18n'
import { leaveRoom } from '../api/commands'
import { useGameStore } from '../store/gameStore'
import { PlayerRoster } from '../components/PlayerRoster'
import { Toast } from '../components/Toast'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { playerDisplayName } from '../lib/format'
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
  const leaveGame = useGameStore((s) => s.leaveGame)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
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

  async function onCopyResult() {
    try {
      await navigator.clipboard.writeText(resultSummary(currentView, winnerIds))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError(t('common.copyFailed'))
    }
  }

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
        <button onClick={onCopyResult}>{copied ? t('common.copied') : t('results.copyResult')}</button>
        <button className="primary" onClick={onLeave} data-testid="return-to-start">
          {t('results.returnToStart')}
        </button>
      </div>
      <AnimatePresence>{copyError && <Toast key="results-copy-error" message={copyError} />}</AnimatePresence>
    </div>
  )
}

function outcomeHeadline(view: GameView, winnerIds: Set<string>): string {
  if (winnerIds.size === 0) return i18next.t('results.noWinner')
  if (winnerIds.size > 1) return i18next.t('results.draw')
  const player = view.players.find((p) => winnerIds.has(p.playerId))
  return i18next.t('results.winnerHeadline', { playerName: playerDisplayName(player) })
}

function resultSummary(view: GameView, winnerIds: Set<string>): string {
  const lines = [i18next.t('results.summaryTitle'), outcomeHeadline(view, winnerIds)]
  const standings = [...view.players].sort((a, b) => b.score - a.score)
  for (const p of standings) {
    lines.push(
      i18next.t('results.summaryLine', { playerName: playerDisplayName(p), score: p.score }) +
        (p.eliminated ? i18next.t('results.summaryEliminatedSuffix') : ''),
    )
  }
  return lines.join('\n')
}
