import { useTranslation } from 'react-i18next'
import type { GameView } from '../api/contracts'
import { findPlayer, playerDisplayName } from '../lib/format'

export interface AnswerRosterProps {
  view: GameView
  participantPlayerIds: readonly string[]
  hasAnswered: Record<string, boolean>
}

// A wax-stamp per participant: pending is a pulsing gilt outline, answered is a filled green
// stamp with a check that pops in - deliberately high-contrast so who's still out matters at a
// glance, not just on close inspection. Bots are labelled as bots since they always take the full
// timeout - this is what keeps a bot's silence reading as expected rather than broken.
export function AnswerRoster({ view, participantPlayerIds, hasAnswered }: AnswerRosterProps) {
  const { t } = useTranslation()
  const answeredCount = participantPlayerIds.filter((playerId) => hasAnswered[playerId]).length
  const total = participantPlayerIds.length

  return (
    <div className="answer-roster-wrap">
      <p className="answer-roster-progress" aria-live="polite">
        {t('answerRoster.progress', { answered: answeredCount, total })}
      </p>
      <ul className="answer-roster">
        {participantPlayerIds.map((playerId) => {
          const player = findPlayer(view, playerId)
          const answered = hasAnswered[playerId] ?? false
          return (
            <li key={playerId} className={answered ? 'answer-stamp answered' : 'answer-stamp waiting'}>
              <span className="stamp-mark" aria-hidden="true">
                {answered ? '✓' : '⋯'}
              </span>
              {playerDisplayName(player)}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
