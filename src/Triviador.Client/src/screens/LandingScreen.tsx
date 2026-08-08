import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence } from 'motion/react'
import { createRoom, joinRoom } from '../api/commands'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import { Toast } from '../components/Toast'
import { HowToPlayModal } from '../components/HowToPlayModal'
import { GoogleSignInButton } from '../components/GoogleSignInButton'
import { Avatar } from '../components/Avatar'
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
  const inviteCode = urlRoomCode()
  // A link opened via #/room/XXXX means the visitor is here to join one specific room, not browse
  // the general landing options - create-room/play-vs-bots/manual-code-entry all just add friction
  // to what should be a one-step "set an identity, land in the lobby" flow (see App.tsx's matching
  // auto-join effect for the already-signed-in case, which skips this screen's form entirely).
  const isInviteMode = inviteCode !== null
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('triviador.name') ?? '')
  const [joinCode, setJoinCode] = useState(() => (inviteCode ?? '').padEnd(4, ' ').split(''))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [howToPlayOpen, setHowToPlayOpen] = useState(false)
  const setSession = useGameStore((s) => s.setSession)
  const applyView = useGameStore((s) => s.applyView)
  const profile = useAuthStore((s) => s.profile)
  const signOut = useAuthStore((s) => s.signOut)
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // App.tsx only ever routes here with a profile that's already fully set up (see
  // AccountSetupScreen) - a signed-in player's own account identity always wins over any
  // client-supplied nickname text, so the name field/requirement is moot once signed in.
  const effectiveName = profile ? (profile.username ?? '') : displayName

  function handleResult(result: JoinResult) {
    if (!result.success || !result.view || !result.roomCode || !result.playerToken) {
      setError(result.rejectionReason ?? t('landing.errorGeneric'))
      setBusy(false)
      return
    }
    if (!profile) localStorage.setItem('triviador.name', displayName.trim())
    setSession({ roomCode: result.roomCode, playerToken: result.playerToken })
    applyView(result.view)
  }

  async function onCreate() {
    if (!effectiveName.trim()) {
      setError(t('landing.errorNameRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      handleResult(await createRoom(effectiveName.trim(), 0, localeToLanguage(i18n.language as Locale)))
    } catch {
      setError(t('landing.errorGeneric'))
      setBusy(false)
    }
  }

  async function onPlayVsBots() {
    if (!effectiveName.trim()) {
      setError(t('landing.errorNameRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      handleResult(await createRoom(effectiveName.trim(), 3, localeToLanguage(i18n.language as Locale)))
    } catch {
      setError(t('landing.errorGeneric'))
      setBusy(false)
    }
  }

  async function onJoin() {
    const code = joinCode.join('').trim().toUpperCase()
    if (!effectiveName.trim() || code.length !== 4) {
      setError(t('landing.errorNameAndCodeRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      handleResult(await joinRoom(code, effectiveName.trim(), null))
    } catch {
      setError(t('landing.errorGeneric'))
      setBusy(false)
    }
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

  function onCodeCellPaste(index: number, e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/[^a-z0-9]/gi, '').toUpperCase()
    if (!pasted) return
    e.preventDefault()
    setJoinCode((prev) => {
      const next = [...prev]
      let lastFilled = index - 1
      for (let i = 0; i < pasted.length && index + i < next.length; i++) {
        next[index + i] = pasted[i]
        lastFilled = index + i
      }
      const focusIndex = lastFilled + 1 < next.length ? lastFilled + 1 : lastFilled
      codeInputRefs.current[focusIndex]?.focus()
      return next
    })
  }

  return (
    <main className="landing paper-card">
      <div className="lamplight" aria-hidden="true" />
      <div className="language-toggle" role="group" aria-label={t('landing.languageGroupLabel')} data-testid="language-toggle">
        <button
          type="button"
          className={i18n.language === 'ru' ? 'language-option active' : 'language-option'}
          onClick={() => setLocalePreference('ru')}
          title={t('landing.languageRussian')}
          aria-label={t('landing.languageRussian')}
          aria-pressed={i18n.language === 'ru'}
          data-testid="language-ru"
        >
          <span aria-hidden="true">🇷🇺</span>
        </button>
        <button
          type="button"
          className={i18n.language === 'en' ? 'language-option active' : 'language-option'}
          onClick={() => setLocalePreference('en')}
          title={t('landing.languageEnglish')}
          aria-label={t('landing.languageEnglish')}
          aria-pressed={i18n.language === 'en'}
          data-testid="language-en"
        >
          <span aria-hidden="true">🇬🇧</span>
        </button>
      </div>
      <div className="landing-brand">
        <h1>{t('app.title')}</h1>
        <p className="landing-tagline">
          {isInviteMode ? t('landing.inviteTagline', { code: inviteCode }) : t('landing.tagline')}
        </p>
        {!isInviteMode && (
          <button
            type="button"
            className="landing-how-to-play"
            onClick={() => setHowToPlayOpen(true)}
            data-testid="how-to-play-open"
          >
            {t('howToPlay.openButton')}
          </button>
        )}
      </div>
      {profile ? (
        <div className="signed-in-identity" data-testid="signed-in-identity">
          <Avatar avatarId={profile.avatarId} />
          <span className="signed-in-name">{t('landing.signedInAs', { username: profile.username })}</span>
          <a href="/recaps" className="landing-how-to-play" data-testid="my-recaps-link">
            {t('recap.myRecaps')}
          </a>
          <button
            type="button"
            className="landing-how-to-play signed-in-signout"
            onClick={() => void signOut()}
            data-testid="sign-out"
          >
            {t('landing.signOut')}
          </button>
        </div>
      ) : (
        <>
          <input
            placeholder={t('landing.namePlaceholder')}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => {
              if (isInviteMode && e.key === 'Enter') void onJoin()
            }}
            maxLength={20}
            data-testid="display-name"
          />
          <GoogleSignInButton />
        </>
      )}
      {isInviteMode ? (
        <div className="landing-actions">
          <button className="primary" onClick={onJoin} disabled={busy} data-testid="join-room">
            {t('landing.joinRoom', { code: inviteCode })}
          </button>
        </div>
      ) : (
        <>
          <div className="landing-actions">
            <button className="primary" onClick={onCreate} disabled={busy} data-testid="create-room">
              {t('landing.createRoom')}
            </button>
            <button onClick={onPlayVsBots} disabled={busy} data-testid="play-vs-bots">
              {t('landing.playVsBots')}
            </button>
          </div>
          <div className="landing-divider" role="presentation">
            <span>{t('landing.orJoinExisting')}</span>
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
                  onPaste={(e) => onCodeCellPaste(index, e)}
                  aria-label={t('landing.roomCodeCharAriaLabel', { n: index + 1 })}
                />
              ))}
            </div>
            <button onClick={onJoin} disabled={busy} data-testid="join-room">
              {t('landing.join')}
            </button>
          </div>
        </>
      )}
      <AnimatePresence>{error && <Toast key="landing-error" message={error} />}</AnimatePresence>
      <HowToPlayModal open={howToPlayOpen} onClose={() => setHowToPlayOpen(false)} />
    </main>
  )
}
