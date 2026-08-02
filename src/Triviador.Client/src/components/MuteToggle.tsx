import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isMuted, setMuted } from '../lib/sound'

export function MuteToggle() {
  const { t } = useTranslation()
  const [muted, setMutedState] = useState(isMuted)

  function toggle() {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  return (
    <button
      type="button"
      className="mute-toggle"
      onClick={toggle}
      aria-label={t(muted ? 'sound.unmute' : 'sound.mute')}
      data-testid="mute-toggle"
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
