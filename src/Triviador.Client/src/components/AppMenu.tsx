import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isMuted, setMuted } from '../lib/sound'

export interface AppMenuProps {
  onClose: () => void
  // null when leaving isn't available right now (e.g. Finished phase) - mirrors the desktop top
  // bar's own `view.phase !== 'Finished'` guard on the leave-game button.
  onLeaveGame: (() => void) | null
}

// Mobile-only counterpart to the desktop top bar: on a phone-width viewport there's no room for
// the title/phase-label/round-progress/mute-icon/leave-button row (see .top-bar-full's mobile
// hiding in App.css - the wrapping was the leading cause of the game view growing tall enough to
// scroll), so all of it collapses into this one corner button's popover instead.
export function AppMenu({ onClose, onLeaveGame }: AppMenuProps) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)
  const [muted, setMutedState] = useState(isMuted)

  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocumentClick)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocumentClick)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  return (
    <div ref={menuRef} className="app-menu paper-card" role="menu" data-testid="app-menu" onClick={(e) => e.stopPropagation()}>
      <button type="button" role="menuitem" onClick={toggleMute} data-testid="app-menu-mute">
        {muted ? t('sound.unmute') : t('sound.mute')}
      </button>
      {onLeaveGame && (
        <button type="button" role="menuitem" className="app-menu-leave" onClick={onLeaveGame} data-testid="app-menu-leave">
          {t('app.leaveGame')}
        </button>
      )}
    </div>
  )
}
