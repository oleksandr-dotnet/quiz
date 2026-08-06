import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnswerValueView, QuestionPromptView } from '../api/contracts'
import { Timer } from './Timer'
import { NumericKeypad } from './NumericKeypad'

const OPTION_HINTS = ['①', '②', '③', '④']

export interface QuestionCardProps {
  prompt: QuestionPromptView
  yourAnswer: AnswerValueView | null
  remainingMs: number
  totalMs: number
  onSubmitChoice: (optionIndex: number) => void
  onSubmitNumeric: (value: number) => void
  /** False when the viewer isn't a participant in this question (e.g. spectating a duel between two
   * other players) - renders the prompt read-only with no clickable options/keypad, since submitting
   * an answer as a non-participant is rejected server-side with HubException "not your turn". */
  interactive?: boolean
}

// The question panel shared by land grab and battle - previously duplicated verbatim between the
// two screens. Choice renders four inked option plates with keyboard hints; Tip is a numeric field
// with the unit as a real suffix; once answered, it becomes a stamped "SEALED" plate instead of a
// plain waiting sentence.
export function QuestionCard({
  prompt,
  yourAnswer,
  remainingMs,
  totalMs,
  onSubmitChoice,
  onSubmitNumeric,
  interactive = true,
}: QuestionCardProps) {
  const { t } = useTranslation()
  const [numericInput, setNumericInput] = useState('')

  useEffect(() => {
    setNumericInput('')
  }, [prompt.questionId])

  useEffect(() => {
    if (!interactive || prompt.kind !== 'Choice' || yourAnswer) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key < '1' || e.key > '4') return
      const index = Number(e.key) - 1
      if (prompt.kind === 'Choice' && index < prompt.options.length) onSubmitChoice(index)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [prompt, yourAnswer, onSubmitChoice, interactive])

  function submitNumeric() {
    const value = Number(numericInput)
    if (!Number.isFinite(value)) return
    onSubmitNumeric(Math.round(value))
  }

  function onKeypadPress(key: string) {
    setNumericInput((prev) => {
      if (key === '⌫') return prev.slice(0, -1)
      if (key === '-') return prev.startsWith('-') ? prev.slice(1) : `-${prev}`
      return prev + key
    })
  }

  return (
    <section className="paper-card question-card" data-testid="question-card">
      <header className="question-card-header">
        <Timer remainingMs={remainingMs} totalMs={totalMs} />
        <p className="question-text">{prompt.text}</p>
      </header>

      {!interactive ? (
        <div className="sealed-plate spectating-plate" data-testid="spectating-plate">
          {t('question.spectating')}
        </div>
      ) : yourAnswer ? (
        <div className="sealed-plate" data-testid="sealed-plate">
          {t('question.sealed')}
        </div>
      ) : prompt.kind === 'Choice' ? (
        <div className="choice-options">
          {prompt.options.map((option, index) => (
            <button
              key={index}
              className="option-plate"
              data-testid={`option-${index}`}
              onClick={() => onSubmitChoice(index)}
            >
              <span className="option-hint" aria-hidden="true">
                {OPTION_HINTS[index] ?? index + 1}
              </span>
              {option}
            </button>
          ))}
        </div>
      ) : (
        <div className="numeric-input">
          <div className="numeric-input-row">
            <input
              type="number"
              value={numericInput}
              data-testid="tip-input"
              onChange={(e) => setNumericInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitNumeric()}
              placeholder={t('question.answerPlaceholder')}
              aria-label={t('question.answerAriaLabel')}
            />
            {prompt.unit && <span className="numeric-unit">{prompt.unit}</span>}
          </div>
          {/* A second "submit" button used to sit inline here too, next to the input - identical
              action as the keypad's own full-width submit below, just costing vertical space in
              exactly the case (Battle's extra headline line) that's tightest on short phones. The
              keypad's submit (and Enter on the input, still wired above) already cover it. */}
          <NumericKeypad onKeyPress={onKeypadPress} onSubmit={submitNumeric} />
        </div>
      )}
    </section>
  )
}
