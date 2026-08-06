import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { battleHeadline } from '../screens/BattleScreen'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { findPlayer, playerLabel } from '../lib/format'
import { playTurnAnnouncement } from '../lib/sound'
import type { GameView } from '../api/contracts'

// Desktop-only (App.tsx renders this behind useIsDesktop()) - what's happening right now (whose
// turn, or the current battle's headline) restated in one line, independent of the dock's own more
// detailed content below. Picking/attack-target sub-phases get their own "whose turn" line; a
// question-answering sub-phase has no single actor to name (everyone's answering at once) so it's
// left to the dock/AnswerRoster instead of being forced into a misleading announcement here.
function announcementText(view: GameView, t: (key: string, options?: Record<string, unknown>) => string): string | null {
  if (view.phase === 'BaseSelection') {
    return view.youAreCurrentPicker
      ? t('base.turnBannerYours')
      : t('base.turnBannerWaiting', { playerName: playerLabel(findPlayer(view, view.currentPickerPlayerId)) })
  }
  if (view.phase === 'LandGrab') {
    const pick = view.pendingRegionPick
    if (!pick) return null
    return pick.currentPickerPlayerId === view.youPlayerId
      ? t('landGrab.turnBannerYours')
      : t('landGrab.turnBannerWaiting', { playerName: playerLabel(findPlayer(view, pick.currentPickerPlayerId)) })
  }
  if (view.phase === 'Battle') {
    const attackTarget = view.pendingAttackTarget
    if (attackTarget) {
      return attackTarget.currentAttackerPlayerId === view.youPlayerId
        ? t('battle.turnBannerYours')
        : t('battle.turnBannerWaiting', { playerName: playerLabel(findPlayer(view, attackTarget.currentAttackerPlayerId)) })
    }
    return battleHeadline(view)
  }
  if (view.phase === 'Finished') return t('app.phase.gameOver')
  return null
}

// Identifies "the current turn" for spotlight-replay purposes - changes exactly when the game moves
// to a new actor/moment worth announcing, deliberately narrower than App.tsx's own dockKey (which
// also keys off reveal/outcome state that has no announcement text of its own here).
function turnKeyFor(view: GameView): string {
  return [
    view.phase,
    view.currentRound,
    view.currentPickerPlayerId,
    view.pendingRegionPick?.currentPickerPlayerId,
    view.pendingAttackTarget?.currentAttackerPlayerId,
    view.battle?.attackerPlayerId,
    view.battle?.defenderPlayerId,
    view.battle?.contestedRegionId,
    view.battle?.assaultQuestionIndex,
    view.battle?.isTiebreakRound,
  ]
    .filter((part) => part !== undefined && part !== null)
    .join('-')
}

const SPOTLIGHT_MS = 1700

export function TurnAnnouncement({ view }: { view: GameView }) {
  const { t } = useTranslation()
  const reducedMotion = usePrefersReducedMotion()
  const text = announcementText(view, t)
  const key = turnKeyFor(view)
  const [spotlightKey, setSpotlightKey] = useState<string | null>(null)

  useEffect(() => {
    if (!text) return
    setSpotlightKey(key)
    playTurnAnnouncement()
    const id = window.setTimeout(() => setSpotlightKey((current) => (current === key ? null : current)), SPOTLIGHT_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!text) return null

  return (
    <>
      {/* The settled, always-present line: sits just under the HUD's player bar (App.css positions
          it there on desktop) for as long as this turn/moment lasts. */}
      <div className="turn-announcement-docked" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.span
            key={key}
            initial={reducedMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.22 }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* The one-shot spotlight: a bigger restatement of the same line, centered on screen for a
          couple seconds whenever the turn/moment actually changes, then it's gone - the docked line
          above is what's left once it fades. Centering lives on a plain (non-motion) wrapper - a
          `motion.div` writes its own animated x/y/scale straight to the element's inline
          `transform`, which would otherwise silently clobber the CSS `transform: translate(-50%,
          -50%)` this needs for centering rather than compose with it. */}
      <AnimatePresence>
        {spotlightKey === key && (
          <div key={key} className="turn-announcement-spotlight-anchor" aria-hidden="true">
            <motion.div
              className="turn-announcement-spotlight"
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: reducedMotion ? 0.15 : 0.38, ease: [0.22, 0.61, 0.36, 1] }}
            >
              {text}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
