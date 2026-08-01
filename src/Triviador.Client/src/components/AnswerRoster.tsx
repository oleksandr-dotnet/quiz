import type { GameView } from '../api/contracts'
import { findPlayer, playerDisplayName } from '../lib/format'

export interface AnswerRosterProps {
  view: GameView
  participantPlayerIds: readonly string[]
  hasAnswered: Record<string, boolean>
}

// A wax-stamp per participant: pending is an outline, answered is a filled stamp. Bots are
// labelled as bots since they always take the full timeout - this is what keeps a bot's silence
// reading as expected rather than broken.
export function AnswerRoster({ view, participantPlayerIds, hasAnswered }: AnswerRosterProps) {
  return (
    <ul className="answer-roster">
      {participantPlayerIds.map((playerId) => {
        const player = findPlayer(view, playerId)
        const answered = hasAnswered[playerId] ?? false
        return (
          <li key={playerId} className={answered ? 'answer-stamp answered' : 'answer-stamp waiting'}>
            <span className="stamp-mark" aria-hidden="true">
              {answered ? '✓' : '○'}
            </span>
            {playerDisplayName(player)}
          </li>
        )
      })}
    </ul>
  )
}
