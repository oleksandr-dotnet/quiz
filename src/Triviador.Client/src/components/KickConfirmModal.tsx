import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModalFocusTrap } from '../hooks/useModalFocusTrap'
import type { KickLandPolicy } from '../api/contracts'

export interface KickConfirmModalProps {
  open: boolean
  targetName: string
  requireLandPolicy: boolean
  onCancel: () => void
  onConfirm: (landPolicy: KickLandPolicy) => void
}

// Mirrors HowToPlayModal's overlay/dialog/focus-trap conventions. Lobby callers pass
// requireLandPolicy=false (there's no territory yet, a single confirm is enough); mid-game callers
// pass true, requiring the host to pick a disposition for the kicked player's territory before the
// kick is sent at all.
export function KickConfirmModal({ open, targetName, requireLandPolicy, onCancel, onConfirm }: KickConfirmModalProps) {
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
    <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label={t('kick.confirmTitle', { name: targetName })}>
      <div ref={dialogRef} tabIndex={-1} className="confirm-card paper-card">
        <h2>{t('kick.confirmTitle', { name: targetName })}</h2>
        <p>{requireLandPolicy ? t('kick.confirmBodyMidGame') : t('kick.confirmBodyLobby')}</p>

        {requireLandPolicy ? (
          <div className="confirm-actions">
            <button type="button" onClick={() => onConfirm('ReleaseLand')} data-testid="kick-release-land">
              {t('kick.releaseLand')}
            </button>
            <button type="button" onClick={() => onConfirm('BotTakeover')} data-testid="kick-bot-takeover">
              {t('kick.botTakeover')}
            </button>
          </div>
        ) : (
          <div className="confirm-actions">
            <button type="button" className="primary" onClick={() => onConfirm('ReleaseLand')} data-testid="kick-confirm">
              {t('kick.confirmButton')}
            </button>
          </div>
        )}

        <button type="button" onClick={onCancel} data-testid="kick-cancel">
          {t('kick.cancel')}
        </button>
      </div>
    </div>
  )
}
