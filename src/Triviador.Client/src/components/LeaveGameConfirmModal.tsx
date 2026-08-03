import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModalFocusTrap } from '../hooks/useModalFocusTrap'

export interface LeaveGameConfirmModalProps {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}

// Mirrors KickConfirmModal's overlay/dialog/focus-trap shell (shared .confirm-* classes) - a native
// window.confirm() here would have been the one remaining spot in the app that broke out of the
// parchment presentation into an unstyled browser-chrome dialog.
export function LeaveGameConfirmModal({ open, onCancel, onConfirm }: LeaveGameConfirmModalProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalFocusTrap(dialogRef, open)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label={t('app.leaveGame')}>
      <div ref={dialogRef} tabIndex={-1} className="confirm-card paper-card">
        <h2>{t('app.leaveGame')}</h2>
        <p>{t('app.leaveGameConfirm')}</p>
        <div className="confirm-actions">
          <button type="button" className="primary" onClick={onConfirm} data-testid="leave-game-confirm">
            {t('app.leaveGame')}
          </button>
        </div>
        <button type="button" onClick={onCancel} data-testid="leave-game-cancel">
          {t('kick.cancel')}
        </button>
      </div>
    </div>
  )
}
