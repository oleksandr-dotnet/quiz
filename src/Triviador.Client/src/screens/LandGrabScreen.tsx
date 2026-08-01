import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18next from '../i18n'
import { pickRegion, submitChoiceAnswer, submitNumericAnswer } from '../api/commands'
import { useCountdown } from '../hooks/useCountdown'
import { QuestionCard } from '../components/QuestionCard'
import { AnswerRoster } from '../components/AnswerRoster'
import { RevealOverlay } from '../components/RevealOverlay'
import { Timer } from '../components/Timer'
import { findPlayer, playerLabel } from '../lib/format'
import { TIMER_TOTALS_MS, questionTotalMs } from '../lib/timers'
import type { GameView, LastRevealView } from '../api/contracts'

// Land grab has no RevealHold (unlike Battle): the result arrives as a one-shot `lastReveal` on the
// same snapshot as the next pick prompt, and is lost on reconnect. Rendered here as a non-blocking
// overlay - stacked above the pick prompt rather than covering it - that fades after this timeout,
// so results and the next prompt coexist instead of fighting. Documented as a known limitation in
// design.md; a real fix needs an engine timing change, out of scope for this change.
const REVEAL_VISIBLE_MS = 3000

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
  const [visibleReveal, setVisibleReveal] = useState<LastRevealView | null>(null)
  const revealTimeoutRef = useRef<number | null>(null)
  const deadline = view.pendingQuestion?.deadline ?? view.pendingRegionPick?.deadline ?? null
  const remainingMs = useCountdown(deadline)

  useEffect(() => {
    if (!view.lastReveal) return
    setVisibleReveal(view.lastReveal)
    if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current)
    revealTimeoutRef.current = window.setTimeout(() => setVisibleReveal(null), REVEAL_VISIBLE_MS)
  }, [view.lastReveal])

  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current)
    }
  }, [])

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
    <div className="land-grab-dock" data-testid="land-grab-dock">
      {visibleReveal && (
        <RevealOverlay
          view={view}
          prompt={visibleReveal.prompt}
          correctAnswer={visibleReveal.correctAnswer}
          answers={visibleReveal.answers}
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
