import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModalFocusTrap } from '../hooks/useModalFocusTrap'
import {
  BASE_ASSAULT_SCORE_BONUS,
  BASE_ASSAULT_UNLOCK_ROUND,
  BASE_HIT_POINTS_DEFAULT,
  MINIMUM_BASE_DISTANCE,
} from '../lib/gameRules'

export interface HowToPlayModalProps {
  open: boolean
  onClose: () => void
}

// Ordered to match the actual phase sequence a room goes through (see GamePhase): the optional
// category-ban draft, base selection, land grab, then every battle-phase mechanic in the order a
// new player will meet them. paragraphs controls how many howToPlay.<key>.bodyN keys are rendered
// (body1 always exists; body2/body3 are opt-in per section so short sections stay one paragraph).
const SECTIONS = [
  { key: 'objective', paragraphs: 1 },
  { key: 'setup', paragraphs: 1 },
  { key: 'categoryBan', paragraphs: 1 },
  { key: 'baseSelection', paragraphs: 1 },
  { key: 'landGrab', paragraphs: 1 },
  { key: 'battleTurns', paragraphs: 1 },
  { key: 'duels', paragraphs: 1 },
  { key: 'baseAssault', paragraphs: 2 },
  { key: 'streaks', paragraphs: 1 },
  { key: 'goldenQuestion', paragraphs: 1 },
  { key: 'scoring', paragraphs: 1 },
] as const

// Overlay/card markup uses a standard dialog pattern (role="dialog" aria-modal, a centered
// paper-themed card) shared with the client's other modal-style overlays.
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
          {SECTIONS.map(({ key, paragraphs }) => (
            <section key={key}>
              <h3>{t(`howToPlay.${key}.heading`)}</h3>
              {Array.from({ length: paragraphs }, (_, i) => (
                <p key={i}>
                  {t(`howToPlay.${key}.body${i + 1}`, {
                    hitPoints: BASE_HIT_POINTS_DEFAULT,
                    scoreBonus: BASE_ASSAULT_SCORE_BONUS,
                    unlockRound: BASE_ASSAULT_UNLOCK_ROUND,
                    minDistance: MINIMUM_BASE_DISTANCE,
                  })}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
