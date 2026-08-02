import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18next from '../i18n'
import { selectAttackTarget, submitChoiceAnswer, submitNumericAnswer } from '../api/commands'
import { useCountdown } from '../hooks/useCountdown'
import { QuestionCard } from '../components/QuestionCard'
import { AnswerRoster } from '../components/AnswerRoster'
import { RevealOverlay } from '../components/RevealOverlay'
import { Timer } from '../components/Timer'
import { findPlayer, playerLabel, secondsRemaining } from '../lib/format'
import { playAttackStarted } from '../lib/sound'
import { TIMER_TOTALS_MS, questionTotalMs } from '../lib/timers'
import type { GameView } from '../api/contracts'

export function battleMapProps(view: GameView) {
  const attackTarget = view.pendingAttackTarget
  return {
    interactive: attackTarget?.currentAttackerPlayerId === view.youPlayerId,
    eligibleRegionIds: attackTarget?.eligibleTargetRegionIds ?? [],
    contestedRegionId: view.battle?.contestedRegionId ?? null,
  }
}

export async function battleOnSelect(view: GameView, regionId: string, onError: (message: string) => void) {
  const pending = view.pendingAttackTarget
  if (!pending || pending.currentAttackerPlayerId !== view.youPlayerId) return
  try {
    await selectAttackTarget(regionId)
  } catch (err) {
    onError(err instanceof Error ? err.message : i18next.t('battle.targetRejected'))
  }
}

function battleHeadline(view: GameView): string | null {
  const battle = view.battle
  if (!battle) return null
  const attackerName = playerLabel(findPlayer(view, battle.attackerPlayerId))
  const defenderName = playerLabel(findPlayer(view, battle.defenderPlayerId))
  const regionName =
    view.regions.find((r) => r.regionId === battle.contestedRegionId)?.name ?? i18next.t('battle.unknownTerritory')
  const you = view.youPlayerId
  const youAreAttacker = battle.attackerPlayerId === you
  const youAreDefender = battle.defenderPlayerId === you
  const hitIndex = battle.assaultQuestionIndex ?? 1

  if (battle.kind === 'BaseAssault') {
    if (battle.attackerPlayerId === battle.defenderPlayerId) {
      return youAreAttacker
        ? i18next.t('battle.headlineSelfHeal')
        : i18next.t('battle.headlineSelfHealOthers', { playerName: attackerName })
    }
    if (youAreAttacker) return i18next.t('battle.headlineAssaultSelfAttack', { defenderName, hitIndex })
    if (youAreDefender) return i18next.t('battle.headlineAssaultSelfDefend', { attackerName, hitIndex })
    return i18next.t('battle.headlineAssaultOthers', { attackerName, defenderName, hitIndex })
  }

  if (youAreAttacker) return i18next.t('battle.headlineDuelSelfAttack', { regionName, defenderName })
  if (youAreDefender) return i18next.t('battle.headlineDuelSelfDefend', { attackerName, regionName })
  return i18next.t('battle.headlineDuelOthers', { attackerName, regionName, defenderName })
}

export function BattleDock({ view, onError }: { view: GameView; onError: (message: string) => void }) {
  const { t } = useTranslation()
  const deadline =
    view.pendingAttackTarget?.deadline ?? view.pendingQuestion?.deadline ?? view.pendingReveal?.deadline ?? null
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

  const attackTarget = view.pendingAttackTarget
  const question = view.pendingQuestion
  const reveal = view.pendingReveal
  const headline = battleHeadline(view)

  // A duel or an assault on someone else's base (never the calm self-heal case, where attacker and
  // defender are the same player) - keyed without assaultQuestionIndex so a later question in the
  // same multi-question assault chain against the same target doesn't replay the cue.
  const battle = view.battle
  const attackStartedKey =
    battle && battle.attackerPlayerId !== battle.defenderPlayerId
      ? `${battle.attackerPlayerId}:${battle.defenderPlayerId}:${battle.contestedRegionId}`
      : null

  useEffect(() => {
    if (!attackStartedKey) return
    playAttackStarted()
  }, [attackStartedKey])

  return (
    <div className="battle-dock" data-testid="battle-dock">
      <h2>{t('battle.roundHeading', { n: view.currentRound })}</h2>
      {headline && <p className="turn-banner battle-headline">{headline}</p>}

      {reveal && (
        <RevealOverlay
          view={view}
          prompt={reveal.prompt}
          correctAnswer={reveal.correctAnswer}
          answers={reveal.answers}
          secondsRemaining={secondsRemaining(remainingMs)}
        />
      )}

      {attackTarget && (
        <section className="paper-card question-card">
          <header className="question-card-header">
            <Timer remainingMs={remainingMs} totalMs={TIMER_TOTALS_MS.attackTargetSelection} />
            <p className="turn-banner">
              {attackTarget.currentAttackerPlayerId === view.youPlayerId
                ? t('battle.turnBannerYours')
                : t('battle.turnBannerWaiting', {
                    playerName: playerLabel(findPlayer(view, attackTarget.currentAttackerPlayerId)),
                  })}
            </p>
          </header>
        </section>
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
    </div>
  )
}
