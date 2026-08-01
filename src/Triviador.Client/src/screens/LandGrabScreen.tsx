import { useEffect, useRef, useState } from 'react'
import { pickRegion, submitChoiceAnswer, submitNumericAnswer } from '../api/commands'
import { useGameStore } from '../store/gameStore'
import { useCountdown } from '../hooks/useCountdown'
import { SEAT_COLORS, colorForPlayer } from './BaseSelectionScreen'
import type { GameView, LastRevealView, PendingQuestionView } from '../api/contracts'

const REVEAL_FADE_MS = 5000

export function LandGrabScreen() {
  const view = useGameStore((s) => s.gameView)
  const [actionError, setActionError] = useState<string | null>(null)
  const [visibleReveal, setVisibleReveal] = useState<LastRevealView | null>(null)
  const [numericInput, setNumericInput] = useState('')
  const revealTimeoutRef = useRef<number | null>(null)

  const deadline = view?.pendingQuestion?.deadline ?? view?.pendingRegionPick?.deadline ?? null
  const remainingMs = useCountdown(deadline)

  useEffect(() => {
    if (!view?.lastReveal) return
    setVisibleReveal(view.lastReveal)
    if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current)
    revealTimeoutRef.current = window.setTimeout(() => setVisibleReveal(null), REVEAL_FADE_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.lastReveal])

  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    setNumericInput('')
  }, [view?.pendingQuestion?.prompt.questionId])

  if (!view) return null

  if (view.landGrabComplete) {
    return (
      <main className="land-grab">
        <h1>Land grab complete</h1>
        <p>Every region has an owner. The next phase isn't built yet - check back soon.</p>
        <ScoreBoard view={view} />
      </main>
    )
  }

  async function onSubmitChoice(optionIndex: number) {
    setActionError(null)
    try {
      await submitChoiceAnswer(optionIndex)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'That answer was rejected.')
    }
  }

  async function onSubmitNumeric() {
    const value = Number(numericInput)
    if (!Number.isFinite(value)) return
    setActionError(null)
    try {
      await submitNumericAnswer(Math.round(value))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'That answer was rejected.')
    }
  }

  async function onPickRegion(regionId: string) {
    const pick = view!.pendingRegionPick
    if (!pick || pick.currentPickerPlayerId !== view!.youPlayerId) return
    // No client-side eligibility filtering here - eligibleRegionIds only drives the highlight.
    // The server is the sole source of legality (RegionNotEligible surfaces as a rejection below),
    // matching BaseSelectionScreen's precedent.
    setActionError(null)
    try {
      await pickRegion(regionId)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'That pick was rejected.')
    }
  }

  const question = view.pendingQuestion
  const regionPick = view.pendingRegionPick

  return (
    <main className="land-grab">
      <h1>Land grab</h1>
      {actionError && <p className="landing-error">{actionError}</p>}

      {visibleReveal && <RevealPanel reveal={visibleReveal} view={view} />}

      {question && (
        <section className="question-panel">
          <p className="turn-banner">
            {question.prompt.text} ({Math.ceil(remainingMs / 1000)}s)
          </p>
          {question.yourAnswer ? (
            <p>Answer locked in - waiting for other players...</p>
          ) : question.prompt.kind === 'Choice' ? (
            <div className="choice-options">
              {question.prompt.options.map((option, index) => (
                <button key={index} onClick={() => onSubmitChoice(index)}>
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <div className="numeric-input">
              <input
                type="number"
                value={numericInput}
                onChange={(e) => setNumericInput(e.target.value)}
                placeholder={question.prompt.unit ?? 'your answer'}
              />
              <button onClick={onSubmitNumeric}>Submit</button>
            </div>
          )}
          <AnsweredChips view={view} question={question} />
        </section>
      )}

      {regionPick && (
        <section>
          <p className="turn-banner">
            {regionPick.currentPickerPlayerId === view.youPlayerId
              ? 'Your pick - claim a highlighted region'
              : `Waiting for ${pickerName(view, regionPick.currentPickerPlayerId)} to pick`}{' '}
            ({Math.ceil(remainingMs / 1000)}s)
          </p>
          <svg viewBox={view.mapViewBox} className="map">
            {view.regions.map((region) => {
              const eligible = regionPick.eligibleRegionIds.includes(region.regionId)
              const mine = regionPick.currentPickerPlayerId === view.youPlayerId
              return (
                <path
                  key={region.regionId}
                  d={region.renderPath}
                  fill={colorForPlayer(view, region.ownerPlayerId)}
                  fillOpacity={region.ownerPlayerId ? 0.85 : 0.25}
                  stroke="#1b1b1b"
                  strokeWidth={region.isBase ? 3 : 1}
                  className={mine && eligible ? 'region selectable' : 'region'}
                  onClick={() => onPickRegion(region.regionId)}
                >
                  <title>
                    {region.regionId} ({region.value}pts){region.isBase ? ' - base' : ''}
                  </title>
                </path>
              )
            })}
          </svg>
        </section>
      )}

      <ScoreBoard view={view} />
    </main>
  )
}

function pickerName(view: GameView, playerId: string): string {
  const player = view.players.find((p) => p.playerId === playerId)
  return player?.displayName ?? (player?.isBot ? 'a bot' : 'a player')
}

function AnsweredChips({ view, question }: { view: GameView; question: PendingQuestionView }) {
  return (
    <ul className="answer-chips">
      {question.participantPlayerIds.map((playerId) => {
        const player = view.players.find((p) => p.playerId === playerId)
        const answered = question.hasAnswered[playerId] ?? false
        return (
          <li key={playerId} className={answered ? 'answered' : 'waiting'}>
            {player?.displayName ?? (player?.isBot ? 'Bot' : 'Player')}
          </li>
        )
      })}
    </ul>
  )
}

function RevealPanel({ reveal, view }: { reveal: LastRevealView; view: GameView }) {
  const correctText =
    reveal.correctAnswer.kind === 'Choice'
      ? reveal.prompt.options[reveal.correctAnswer.optionIndex ?? -1]
      : String(reveal.correctAnswer.numericValue)

  return (
    <section className="reveal-panel">
      <p>{reveal.prompt.text}</p>
      <p>Correct answer: {correctText}</p>
      <ol>
        {[...reveal.answers]
          .sort((a, b) => a.rank - b.rank)
          .map((a) => {
            const player = view.players.find((p) => p.playerId === a.playerId)
            const answerText =
              a.answer.kind === 'Choice'
                ? reveal.prompt.options[a.answer.optionIndex ?? -1]
                : a.answer.kind === 'Numeric'
                  ? String(a.answer.numericValue)
                  : 'no answer'
            return (
              <li key={a.playerId}>
                {player?.displayName ?? (player?.isBot ? 'Bot' : 'Player')}: {answerText}
              </li>
            )
          })}
      </ol>
    </section>
  )
}

function ScoreBoard({ view }: { view: GameView }) {
  return (
    <ul className="player-list">
      {[...view.players]
        .sort((a, b) => b.score - a.score)
        .map((p) => (
          <li key={p.playerId} style={{ color: SEAT_COLORS[p.seat % SEAT_COLORS.length] }}>
            {p.displayName ?? (p.isBot ? 'Bot' : 'Player')} - {p.score} pts
          </li>
        ))}
    </ul>
  )
}
