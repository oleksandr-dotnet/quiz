import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import i18next from '../i18n'
import type { AnswerValueView, GameView, QuestionPromptView, RevealedAnswerView } from '../api/contracts'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { findPlayer, laurelNumeral, playerDisplayName } from '../lib/format'
import { colorForPlayer } from '../lib/seats'
import { playCorrect, playGolden, playIncorrect } from '../lib/sound'
import { ArcheryTargetReveal } from './ArcheryTargetReveal'

export interface RevealOverlayProps {
  view: GameView
  prompt: QuestionPromptView
  correctAnswer: AnswerValueView
  answers: readonly RevealedAnswerView[]
  secondsRemaining?: number | null
  isGolden?: boolean
}

const MAX_SPEED_BAR_MS = 8000

// Shared between land grab (a non-blocking 3s overlay) and battle (a live RevealHold window):
// a ranked scroll with a tick/cross, a laurel numeral for rank, and elapsedMs as a speed bar -
// both fields already exist on RevealedAnswerDto and were previously computed then discarded.
export function RevealOverlay({ view, prompt, correctAnswer, answers, secondsRemaining, isGolden = false }: RevealOverlayProps) {
  const { t } = useTranslation()
  const reducedMotion = usePrefersReducedMotion()
  const correctText = answerText(prompt, correctAnswer)
  const ranked = [...answers].sort((a, b) => a.rank - b.rank)

  useEffect(() => {
    // Golden replaces the ordinary correct/incorrect cue rather than layering on top of it - the
    // fanfare is the headline moment here, and the ✓/✗ marks in the scroll below already carry the
    // per-player correctness detail, so there is no information lost by not also playing the plain
    // chime.
    if (isGolden) {
      playGolden()
      return
    }
    const own = ranked.find((a) => a.playerId === view.youPlayerId)
    if (!own || own.answer.kind === 'None') return
    if (answerText(prompt, own.answer) === correctText) playCorrect()
    else playIncorrect()
    // Fire exactly once per resolved question, not on every re-render (e.g. a ticking
    // secondsRemaining) while this reveal stays mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt.questionId])

  return (
    <section
      className={isGolden ? 'paper-card reveal-overlay reveal-overlay-golden' : 'paper-card reveal-overlay'}
      data-testid="reveal-overlay"
    >
      {isGolden &&
        (reducedMotion ? (
          <div className="golden-reveal-banner" data-testid="golden-reveal-banner">
            {t('reveal.goldenLabel')}
          </div>
        ) : (
          <motion.div
            className="golden-reveal-banner"
            data-testid="golden-reveal-banner"
            initial={{ opacity: 0, scale: 0.85, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {t('reveal.goldenLabel')}
          </motion.div>
        ))}
      <p className="question-text">{prompt.text}</p>
      <p className="correct-answer">
        {t('reveal.correctAnswerLabel')} <strong>{correctText}</strong>
      </p>

      {prompt.kind === 'Tip' && (
        <ArcheryTargetReveal key={prompt.questionId} prompt={prompt} correctAnswer={correctAnswer} answers={ranked} view={view} />
      )}

      <ol className="reveal-scroll">
        {ranked.map((a) => {
          const player = findPlayer(view, a.playerId)
          const correct = a.answer.kind !== 'None' && answerText(prompt, a.answer) === correctText
          const speedFraction = a.elapsedMs !== null ? Math.min(1, a.elapsedMs / MAX_SPEED_BAR_MS) : 0
          return (
            <li key={a.playerId} className="reveal-row">
              <span className="laurel">{laurelNumeral(a.rank)}</span>
              <span className={correct ? 'reveal-mark correct' : 'reveal-mark'} aria-hidden="true">
                {a.answer.kind === 'None' ? '—' : correct ? '✓' : '✗'}
              </span>
              <span className="reveal-name" style={{ color: colorForPlayer(view, a.playerId) }}>
                {playerDisplayName(player)}
              </span>
              <span className="reveal-answer">{answerText(prompt, a.answer)}</span>
              {a.elapsedMs !== null && (
                <span className="speed-bar-track" aria-hidden="true">
                  <span className="speed-bar-fill" style={{ width: `${speedFraction * 100}%` }} />
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {secondsRemaining != null && (
        <p className="reveal-timer tabular-nums">{t('reveal.nextIn', { seconds: secondsRemaining })}</p>
      )}
    </section>
  )
}

function answerText(prompt: QuestionPromptView, answer: AnswerValueView): string {
  if (answer.kind === 'Choice') return prompt.options[answer.optionIndex ?? -1] ?? '?'
  if (answer.kind === 'Numeric') return String(answer.numericValue)
  return i18next.t('reveal.noAnswer')
}
