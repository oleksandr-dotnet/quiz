import { useTranslation } from 'react-i18next'
import i18next from '../i18n'
import type { AnswerValueView, GameView, QuestionPromptView, RevealedAnswerView } from '../api/contracts'
import { findPlayer, laurelNumeral, playerDisplayName } from '../lib/format'
import { colorForPlayer } from '../lib/seats'
import { ArcheryTargetReveal } from './ArcheryTargetReveal'

export interface RevealOverlayProps {
  view: GameView
  prompt: QuestionPromptView
  correctAnswer: AnswerValueView
  answers: readonly RevealedAnswerView[]
  secondsRemaining?: number | null
}

const MAX_SPEED_BAR_MS = 8000

// Shared between land grab (a non-blocking 3s overlay) and battle (a live RevealHold window):
// a ranked scroll with a tick/cross, a laurel numeral for rank, and elapsedMs as a speed bar -
// both fields already exist on RevealedAnswerDto and were previously computed then discarded.
export function RevealOverlay({ view, prompt, correctAnswer, answers, secondsRemaining }: RevealOverlayProps) {
  const { t } = useTranslation()
  const correctText = answerText(prompt, correctAnswer)
  const ranked = [...answers].sort((a, b) => a.rank - b.rank)

  return (
    <section className="paper-card reveal-overlay" data-testid="reveal-overlay">
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
