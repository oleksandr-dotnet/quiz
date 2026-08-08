import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchRecap } from '../api/recaps'
import { Avatar } from '../components/Avatar'
import type { RecapHighlight, RecapPayload, RecapPlayer } from '../api/contracts'

export interface RecapScreenProps {
  id: string
}

function highlightText(t: (key: string, opts?: Record<string, unknown>) => string, h: RecapHighlight, playersById: Map<string, RecapPlayer>): string {
  const nameOf = (id: string | null) => (id ? (playersById.get(id)?.displayName ?? id) : '')
  switch (h.kind) {
    case 'BaseAssault':
      return h.attackerWon
        ? t('recap.highlightBaseAssaultWon', { attacker: nameOf(h.attackerPlayerId), defender: nameOf(h.defenderPlayerId) })
        : t('recap.highlightBaseAssaultDefended', { defender: nameOf(h.defenderPlayerId), attacker: nameOf(h.attackerPlayerId) })
    case 'GoldenQuestion': {
      const winners = (h.winnerPlayerIds ?? []).map(nameOf).join(', ')
      return winners ? t('recap.highlightGoldenQuestion', { winners }) : t('recap.highlightGoldenQuestionUnclaimed')
    }
    case 'CategoryBansResolved':
      return t('recap.highlightCategoryBans', { categories: (h.categories ?? []).join(', ') })
    default:
      return ''
  }
}

export function RecapScreen({ id }: RecapScreenProps) {
  const { t } = useTranslation()
  const [state, setState] = useState<'loading' | 'notFound' | 'loaded'>('loading')
  const [recap, setRecap] = useState<RecapPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    fetchRecap(id).then((payload) => {
      if (cancelled) return
      if (!payload) {
        setState('notFound')
        return
      }
      setRecap(payload)
      setState('loaded')
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (state === 'loading') {
    return (
      <main className="landing paper-card" data-testid="recap-screen">
        <p>{t('recap.loading')}</p>
      </main>
    )
  }

  if (state === 'notFound' || !recap) {
    return (
      <main className="landing paper-card" data-testid="recap-screen-not-found">
        <div className="landing-brand">
          <h1>{t('app.title')}</h1>
          <p className="landing-tagline">{t('recap.notFound')}</p>
        </div>
        <div className="landing-actions">
          <a className="primary" href="/">
            {t('results.returnToStart')}
          </a>
        </div>
      </main>
    )
  }

  const standings = [...recap.players].sort((a, b) => b.finalScore - a.finalScore)
  const winners = new Set(recap.winnerPlayerIds)
  const playersById = new Map(recap.players.map((p) => [p.playerId, p]))
  const winnerNames = standings.filter((p) => winners.has(p.playerId)).map((p) => p.displayName)

  return (
    <main className="landing paper-card" data-testid="recap-screen">
      <div className="landing-brand">
        <h1>{t('app.title')}</h1>
        <p className="landing-tagline">
          {winnerNames.length > 0 ? t('recap.headline', { names: winnerNames.join(' & ') }) : t('recap.headlineNoWinner')}
        </p>
        <p className="landing-tagline">{t('recap.meta', { roomCode: recap.roomCode, rounds: recap.roundsPlayed })}</p>
      </div>

      <img className="recap-summary-image" src={`/api/recaps/${id}/image.svg`} alt={t('recap.imageAlt')} />

      <ul className="recap-standings" data-testid="recap-standings">
        {standings.map((p) => (
          <li key={p.playerId} className={winners.has(p.playerId) ? 'recap-standing-row winner' : 'recap-standing-row'}>
            <div className="recap-standing-name">
              <Avatar avatarId={p.avatarId} />
              {p.displayName}
              {p.eliminated && <span className="fallen-banner">{t('playerRoster.fallen')}</span>}
            </div>
            <div className="recap-standing-stats">
              {t('recap.playerStats', { score: p.finalScore, territories: p.territoriesHeld, streak: p.longestStreak })}
            </div>
          </li>
        ))}
      </ul>

      {recap.highlights.length > 0 && (
        <div>
          <h2>{t('recap.highlightsTitle')}</h2>
          <ul>
            {recap.highlights.map((h, i) => (
              <li key={i}>{highlightText(t, h, playersById)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="landing-actions">
        <a className="primary" href="/">
          {t('results.returnToStart')}
        </a>
      </div>
    </main>
  )
}
