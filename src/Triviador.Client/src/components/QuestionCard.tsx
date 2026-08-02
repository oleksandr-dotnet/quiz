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
}

// The question panel shared by land grab and battle - previously duplicated verbatim between the
// two screens. Choice renders four inked option plates with keyboard hints; Tip is a numeric field
// with the unit as a real suffix; once answered, it becomes a stamped "SEALED" plate instead of a
// plain waiting sentence.
export function QuestionCard({ prompt, yourAnswer, remainingMs, totalMs, onSubmitChoice, onSubmitNumeric }: QuestionCardProps) {
  const { t } = useTranslation()
  const [numericInput, setNumericInput] = useState('')

  useEffect(() => {
    setNumericInput('')
  }, [prompt.questionId])

  useEffect(() => {
    if (prompt.kind !== 'Choice' || yourAnswer) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key < '1' || e.key > '4') return
      const index = Number(e.key) - 1
      if (prompt.kind === 'Choice' && index < prompt.options.length) onSubmitChoice(index)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [prompt, yourAnswer, onSubmitChoice])

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

      {yourAnswer ? (
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
            <button className="primary" onClick={submitNumeric}>
              {t('common.submit')}
            </button>
          </div>
          <NumericKeypad onKeyPress={onKeypadPress} onSubmit={submitNumeric} />
        </div>
      )}
    </section>
  )
}
