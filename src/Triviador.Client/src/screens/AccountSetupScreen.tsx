import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setAvatar, setUsername } from '../api/authApi'
import { AVATAR_IDS, avatarGlyph } from '../lib/avatars'
import { useAuthStore } from '../store/authStore'

/// Shown once, right after a first Google sign-in - player-accounts's "must set a unique username
/// and an avatar before playing" requirement. A returning, already-set-up account never sees this.
export function AccountSetupScreen() {
  const { t } = useTranslation()
  const accessToken = useAuthStore((s) => s.accessToken)
  const profile = useAuthStore((s) => s.profile)
  const setProfile = useAuthStore((s) => s.setProfile)
  const [username, setUsernameInput] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(profile?.avatarId ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit() {
    if (!accessToken) return
    const trimmed = username.trim()
    if (!/^[A-Za-z0-9_]{3,20}$/.test(trimmed)) {
      setError(t('accountSetup.errorInvalidUsername'))
      return
    }
    if (!selectedAvatar) {
      setError(t('accountSetup.errorAvatarRequired'))
      return
    }

    setBusy(true)
    setError(null)
    const usernameResult = await setUsername(accessToken, trimmed)
    if (!usernameResult.ok) {
      setError(
        usernameResult.error === 'UsernameTaken'
          ? t('accountSetup.errorUsernameTaken')
          : t('accountSetup.errorInvalidUsername'),
      )
      setBusy(false)
      return
    }

    const avatarProfile = await setAvatar(accessToken, selectedAvatar)
    setBusy(false)
    if (!avatarProfile) {
      setError(t('accountSetup.errorAvatarRequired'))
      return
    }
    setProfile(avatarProfile)
  }

  return (
    <main className="landing paper-card">
      <div className="landing-brand">
        <h1>{t('accountSetup.title')}</h1>
        <p className="landing-tagline">{t('accountSetup.tagline')}</p>
      </div>
      <input
        placeholder={t('accountSetup.usernamePlaceholder')}
        value={username}
        onChange={(e) => setUsernameInput(e.target.value)}
        maxLength={20}
        data-testid="account-setup-username"
      />
      <div className="avatar-grid" role="group" aria-label={t('accountSetup.avatarLabel')}>
        {AVATAR_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={selectedAvatar === id ? 'avatar-choice active' : 'avatar-choice'}
            onClick={() => setSelectedAvatar(id)}
            aria-pressed={selectedAvatar === id}
            data-testid={`avatar-${id}`}
          >
            {avatarGlyph(id)}
          </button>
        ))}
      </div>
      {error && <p className="toast-error-inline">{error}</p>}
      <div className="landing-actions">
        <button className="primary" onClick={() => void onSubmit()} disabled={busy} data-testid="account-setup-submit">
          {t('accountSetup.submit')}
        </button>
      </div>
    </main>
  )
}
