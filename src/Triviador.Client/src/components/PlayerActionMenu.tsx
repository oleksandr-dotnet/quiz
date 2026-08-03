import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

export interface PlayerActionMenuProps {
  onKick: (e: ReactMouseEvent) => void
  onClose: () => void
}

// A small anchored popover rendered inside the clicked player-card (position: relative on the
// card, position: absolute here) - the host's entry point into kicking a player. Only one action
// today; shaped as a menu (not a single inline button) so it reads as "click a player, then choose
// an action" rather than an accidental one-click kick.
export function PlayerActionMenu({ onKick, onClose }: PlayerActionMenuProps) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)

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

  return (
    <div
      ref={menuRef}
      className="player-action-menu paper-card"
      role="menu"
      data-testid="player-action-menu"
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" role="menuitem" onClick={onKick} data-testid="player-action-kick">
        {t('playerRoster.kickAction')}
      </button>
    </div>
  )
}
