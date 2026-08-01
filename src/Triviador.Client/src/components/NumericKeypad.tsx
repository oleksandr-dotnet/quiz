import { useTranslation } from 'react-i18next'

export interface NumericKeypadProps {
  onKeyPress: (key: string) => void
  onSubmit: () => void
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', '⌫']

// A mouse/touch-clickable digit pad that shares the same string state as direct physical-keyboard
// typing into QuestionCard's numeric <input> - either path, or a mix of both, updates one value.
// Emits raw key presses rather than computing the next value itself: composing off a `value` prop
// would go stale if two presses batch within the same React commit (e.g. rapid clicks), silently
// dropping a digit - the parent applies each press with a functional state update instead.
export function NumericKeypad({ onKeyPress, onSubmit }: NumericKeypadProps) {
  const { t } = useTranslation()

  return (
    <div className="numeric-keypad" data-testid="numeric-keypad">
      <div className="numeric-keypad-grid">
        {DIGITS.map((key) => (
          <button
            key={key}
            type="button"
            className="numeric-keypad-key"
            data-testid={key === '⌫' ? 'keypad-backspace' : `keypad-${key}`}
            aria-label={key === '⌫' ? t('keypad.backspace') : key}
            onClick={() => onKeyPress(key)}
          >
            {key}
          </button>
        ))}
      </div>
      <button className="primary numeric-keypad-submit" data-testid="keypad-submit" onClick={onSubmit}>
        {t('keypad.submit')}
      </button>
    </div>
  )
}
