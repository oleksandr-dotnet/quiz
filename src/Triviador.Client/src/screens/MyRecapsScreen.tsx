import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchMyRecaps } from '../api/recaps'
import { GoogleSignInButton } from '../components/GoogleSignInButton'
import { useAuthStore } from '../store/authStore'
import type { RecapSummary } from '../api/contracts'

export function MyRecapsScreen() {
  const { t } = useTranslation()
  const accessToken = useAuthStore((s) => s.accessToken)
  const restoreAttempted = useAuthStore((s) => s.restoreAttempted)
  const restoreSession = useAuthStore((s) => s.restoreSession)
  const [recaps, setRecaps] = useState<RecapSummary[] | null>(null)

  useEffect(() => {
    if (!restoreAttempted) void restoreSession()
  }, [restoreAttempted, restoreSession])

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    fetchMyRecaps(accessToken).then((result) => {
      if (!cancelled) setRecaps(result ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  if (!restoreAttempted) {
    return <main className="landing paper-card" data-testid="my-recaps-screen" />
  }

  if (!accessToken) {
    return (
      <main className="landing paper-card" data-testid="my-recaps-screen">
        <div className="landing-brand">
          <h1>{t('app.title')}</h1>
          <p className="landing-tagline" data-testid="recap-sign-in-prompt">
            {t('recap.signInToView')}
          </p>
        </div>
        <GoogleSignInButton />
        <div className="landing-actions">
          <a className="primary" href="/">
            {t('results.returnToStart')}
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="landing paper-card" data-testid="my-recaps-screen">
      <div className="landing-brand">
        <h1>{t('app.title')}</h1>
        <p className="landing-tagline">{t('recap.myRecaps')}</p>
      </div>

      {recaps === null && <p>{t('recap.loading')}</p>}
      {recaps !== null && recaps.length === 0 && <p>{t('recap.noneShared')}</p>}
      {recaps !== null && recaps.length > 0 && (
        <ul className="player-roster" data-testid="my-recaps-list">
          {recaps.map((r) => (
            <li key={r.id} className="player-card">
              <a href={`/recap/${r.id}`} data-testid={`my-recap-${r.id}`}>
                {r.winnerDisplayNames.length > 0
                  ? t('recap.headline', { names: r.winnerDisplayNames.join(' & ') })
                  : t('recap.headlineNoWinner')}
                {' · '}
                {t('recap.listMeta', { roomCode: r.roomCode, date: new Date(r.finishedAtUtc).toLocaleDateString() })}
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="landing-actions">
        <a className="primary" href="/">
          {t('results.returnToStart')}
        </a>
      </div>
    </main>
  )
}
