import { useTranslation } from 'react-i18next'
import i18next from '../i18n'
import { pickRegion, submitChoiceAnswer, submitNumericAnswer } from '../api/commands'
import { useCountdown } from '../hooks/useCountdown'
import { useLandGrabReveal } from '../hooks/useLandGrabReveal'
import { QuestionCard } from '../components/QuestionCard'
import { AnswerRoster } from '../components/AnswerRoster'
import { RevealOverlay } from '../components/RevealOverlay'
import { Timer } from '../components/Timer'
import { findPlayer, playerLabel } from '../lib/format'
import { TIMER_TOTALS_MS, questionTotalMs } from '../lib/timers'
import type { GameView } from '../api/contracts'

export function landGrabMapProps(view: GameView) {
  const regionPick = view.pendingRegionPick
  return {
    interactive: regionPick?.currentPickerPlayerId === view.youPlayerId,
    eligibleRegionIds: regionPick?.eligibleRegionIds ?? [],
    contestedRegionId: null as string | null,
  }
}

export async function landGrabOnSelect(view: GameView, regionId: string, onError: (message: string) => void) {
  const pick = view.pendingRegionPick
  if (!pick || pick.currentPickerPlayerId !== view.youPlayerId) return
  // No client-side eligibility filtering - eligibleRegionIds only drives the highlight; the server
  // is the sole source of legality (a RegionNotEligible rejection surfaces via onError).
  try {
    await pickRegion(regionId)
  } catch (err) {
    onError(err instanceof Error ? err.message : i18next.t('common.pickRejected'))
  }
}

export function LandGrabDock({ view, onError }: { view: GameView; onError: (message: string) => void }) {
  const { t } = useTranslation()
  const visibleReveal = useLandGrabReveal(view)
  const deadline = view.pendingQuestion?.deadline ?? view.pendingRegionPick?.deadline ?? null
  const remainingMs = useCountdown(deadline)

  async function onSubmitChoice(optionIndex: number) {
    try {
      await submitChoiceAnswer(optionIndex)
    } catch (err) {
      onError(err instanceof Error ? err.message : t('common.answerRejected'))
    }
  }

  async function onSubmitNumeric(value: number) {
    try {
      await submitNumericAnswer(value)
    } catch (err) {
      onError(err instanceof Error ? err.message : t('common.answerRejected'))
    }
  }

  const question = view.pendingQuestion
  const regionPick = view.pendingRegionPick

  return (
    <div className={visibleReveal ? 'land-grab-dock reveal-active' : 'land-grab-dock'} data-testid="land-grab-dock">
      {visibleReveal && (
        <RevealOverlay
          view={view}
          prompt={visibleReveal.prompt}
          correctAnswer={visibleReveal.correctAnswer}
          answers={visibleReveal.answers}
          isGolden={visibleReveal.isGolden}
        />
      )}

      {question && (
        <QuestionCard
          prompt={question.prompt}
          yourAnswer={question.yourAnswer}
          remainingMs={remainingMs}
          totalMs={questionTotalMs(question.prompt.kind)}
          onSubmitChoice={onSubmitChoice}
          onSubmitNumeric={onSubmitNumeric}
          interactive={question.participantPlayerIds.includes(view.youPlayerId)}
        />
      )}
      {question && <AnswerRoster view={view} participantPlayerIds={question.participantPlayerIds} hasAnswered={question.hasAnswered} />}

      {regionPick && (
        <section className="paper-card question-card">
          <header className="question-card-header">
            <Timer remainingMs={remainingMs} totalMs={TIMER_TOTALS_MS.landGrabPick} />
            <p className="turn-banner">
              {regionPick.currentPickerPlayerId === view.youPlayerId
                ? t('landGrab.turnBannerYours')
                : t('landGrab.turnBannerWaiting', {
                    playerName: playerLabel(findPlayer(view, regionPick.currentPickerPlayerId)),
                  })}
            </p>
          </header>
        </section>
      )}
    </div>
  )
}
