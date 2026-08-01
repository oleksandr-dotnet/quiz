import { useTranslation } from 'react-i18next'
import i18next from '../i18n'
import { selectBase } from '../api/commands'
import { useCountdown } from '../hooks/useCountdown'
import { Timer } from '../components/Timer'
import { findPlayer, playerLabel } from '../lib/format'
import { TIMER_TOTALS_MS } from '../lib/timers'
import type { GameView } from '../api/contracts'

export function baseSelectionMapProps(view: GameView) {
  return {
    interactive: view.youAreCurrentPicker,
    eligibleRegionIds: view.pendingBasePick?.eligibleRegionIds ?? [],
    contestedRegionId: null as string | null,
  }
}

export async function baseSelectionOnSelect(view: GameView, regionId: string, onError: (message: string) => void) {
  if (!view.youAreCurrentPicker) return
  try {
    await selectBase(regionId)
  } catch (err) {
    onError(err instanceof Error ? err.message : i18next.t('common.pickRejected'))
  }
}

export function BaseSelectionDock({ view }: { view: GameView }) {
  const { t } = useTranslation()
  const remainingMs = useCountdown(view.deadlineUtc)
  const currentPicker = findPlayer(view, view.currentPickerPlayerId)

  return (
    <section className="paper-card question-card" data-testid="base-selection-dock">
      <header className="question-card-header">
        <Timer remainingMs={remainingMs} totalMs={TIMER_TOTALS_MS.basePick} />
        <p className="turn-banner">
          {view.youAreCurrentPicker
            ? t('base.turnBannerYours')
            : t('base.turnBannerWaiting', { playerName: playerLabel(currentPicker) })}
        </p>
      </header>
    </section>
  )
}
