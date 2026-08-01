import { useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { createRoom, joinRoom } from '../api/commands'
import { useGameStore } from '../store/gameStore'
import { Toast } from '../components/Toast'
import { setLocalePreference, type Locale } from '../i18n'
import type { JoinResult, Language } from '../api/contracts'

function localeToLanguage(locale: Locale): Language {
  return locale === 'en' ? 'English' : 'Russian'
}

function urlRoomCode(): string | null {
  const match = /^#\/room\/([A-Za-z0-9]{4})/.exec(window.location.hash)
  return match ? match[1].toUpperCase() : null
}

export function LandingScreen() {
  const { t, i18n } = useTranslation()
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('triviador.name') ?? '')
  const [joinCode, setJoinCode] = useState(() => (urlRoomCode() ?? '').padEnd(4, ' ').split(''))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const setSession = useGameStore((s) => s.setSession)
  const applyView = useGameStore((s) => s.applyView)
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([])

  function handleResult(result: JoinResult) {
    if (!result.success || !result.view || !result.roomCode || !result.playerToken) {
      setError(result.rejectionReason ?? t('landing.errorGeneric'))
      setBusy(false)
      return
    }
    localStorage.setItem('triviador.name', displayName.trim())
    setSession({ roomCode: result.roomCode, playerToken: result.playerToken })
    applyView(result.view)
  }

  async function onCreate() {
    if (!displayName.trim()) {
      setError(t('landing.errorNameRequired'))
      return
    }
    setBusy(true)
    setError(null)
    handleResult(await createRoom(displayName.trim(), 0, localeToLanguage(i18n.language as Locale)))
  }

  async function onPlayVsBots() {
    if (!displayName.trim()) {
      setError(t('landing.errorNameRequired'))
      return
    }
    setBusy(true)
    setError(null)
    handleResult(await createRoom(displayName.trim(), 3, localeToLanguage(i18n.language as Locale)))
  }

  async function onJoin() {
    const code = joinCode.join('').trim().toUpperCase()
    if (!displayName.trim() || code.length !== 4) {
      setError(t('landing.errorNameAndCodeRequired'))
      return
    }
    setBusy(true)
    setError(null)
    handleResult(await joinRoom(code, displayName.trim(), null))
  }

  function onCodeCellChange(index: number, raw: string) {
    const char = raw.slice(-1).toUpperCase()
    setJoinCode((prev) => {
      const next = [...prev]
      next[index] = char
      return next
    })
    if (char && index < 3) {
      codeInputRefs.current[index + 1]?.focus()
    }
  }

  function onCodeCellKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !joinCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus()
    }
  }

  return (
    <main className="landing paper-card">
      <div className="language-toggle" role="group" aria-label="Language" data-testid="language-toggle">
        <button
          className={i18n.language === 'ru' ? 'language-option active' : 'language-option'}
          onClick={() => setLocalePreference('ru')}
          data-testid="language-ru"
        >
          {t('landing.languageRussian')}
        </button>
        <button
          className={i18n.language === 'en' ? 'language-option active' : 'language-option'}
          onClick={() => setLocalePreference('en')}
          data-testid="language-en"
        >
          {t('landing.languageEnglish')}
        </button>
      </div>
      <h1>{t('app.title')}</h1>
      <input
        placeholder={t('landing.namePlaceholder')}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        maxLength={20}
        data-testid="display-name"
      />
      <div className="landing-actions">
        <button className="primary" onClick={onCreate} disabled={busy} data-testid="create-room">
          {t('landing.createRoom')}
        </button>
        <button onClick={onPlayVsBots} disabled={busy} data-testid="play-vs-bots">
          {t('landing.playVsBots')}
        </button>
      </div>
      <div className="landing-join">
        <div className="code-input" data-testid="join-code">
          {joinCode.map((char, index) => (
            <input
              key={index}
              ref={(el) => (codeInputRefs.current[index] = el)}
              value={char.trim()}
              maxLength={1}
              onChange={(e) => onCodeCellChange(index, e.target.value)}
              onKeyDown={(e) => onCodeCellKeyDown(index, e)}
              aria-label={t('landing.roomCodeCharAriaLabel', { n: index + 1 })}
            />
          ))}
        </div>
        <button onClick={onJoin} disabled={busy} data-testid="join-room">
          {t('landing.join')}
        </button>
      </div>
      {error && <Toast message={error} />}
    </main>
  )
}
