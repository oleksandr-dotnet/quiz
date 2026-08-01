import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18next from '../i18n'
import { leaveRoom } from '../api/commands'
import { useGameStore } from '../store/gameStore'
import { PlayerRoster } from '../components/PlayerRoster'
import { playerDisplayName } from '../lib/format'
import type { GameView } from '../api/contracts'

export function ResultsDock() {
  const { t } = useTranslation()
  const view = useGameStore((s) => s.gameView)
  const setSession = useGameStore((s) => s.setSession)
  const [copied, setCopied] = useState(false)
  if (!view) return null
  const currentView = view

  const winnerIds = new Set(currentView.outcome?.winnerPlayerIds ?? [])

  async function onLeave() {
    await leaveRoom()
    setSession(null)
  }

  async function onCopyResult() {
    await navigator.clipboard.writeText(resultSummary(currentView, winnerIds))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="results" data-testid="results-dock">
      <h2 className="winner-headline">{outcomeHeadline(view, winnerIds)}</h2>
      <PlayerRoster view={view} sort="score" showWinners={winnerIds} />
      <div className="landing-actions">
        <button onClick={onCopyResult}>{copied ? t('common.copied') : t('results.copyResult')}</button>
        <button className="primary" onClick={onLeave} data-testid="return-to-start">
          {t('results.returnToStart')}
        </button>
      </div>
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
