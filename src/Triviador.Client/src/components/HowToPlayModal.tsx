import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModalFocusTrap } from '../hooks/useModalFocusTrap'

export interface HowToPlayModalProps {
  open: boolean
  onClose: () => void
}

const PHASE_KEYS = ['baseSelection', 'landGrab', 'battle', 'winCondition'] as const

// Overlay/card markup mirrors RotateDeviceGate's dialog pattern (role="dialog" aria-modal, a
// centered paper-themed card) so the client has one consistent modal shape rather than two.
export function HowToPlayModal({ open, onClose }: HowToPlayModalProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalFocusTrap(dialogRef, open)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="how-to-play-overlay" role="dialog" aria-modal="true" aria-label={t('howToPlay.title')}>
      <div ref={dialogRef} tabIndex={-1} className="how-to-play-card paper-card">
        <button
          type="button"
          className="how-to-play-close"
          onClick={onClose}
          aria-label={t('howToPlay.close')}
          data-testid="how-to-play-close"
        >
          ×
        </button>
        <h2>{t('howToPlay.title')}</h2>
        <div className="how-to-play-phases">
          {PHASE_KEYS.map((key) => (
            <section key={key}>
              <h3>{t(`howToPlay.${key}.heading`)}</h3>
              <p>{t(`howToPlay.${key}.body`)}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
