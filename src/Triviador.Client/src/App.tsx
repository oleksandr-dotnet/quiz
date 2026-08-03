import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import './App.css'
import { ensureConnected } from './api/connection'
import { joinRoom, leaveRoom, kickPlayer } from './api/commands'
import { applyRoomLanguage } from './i18n'
import { useAuthStore } from './store/authStore'
import { useGameStore } from './store/gameStore'
import { LandingScreen } from './screens/LandingScreen'
import { AccountSetupScreen } from './screens/AccountSetupScreen'
import { LobbyScreen } from './screens/LobbyScreen'
import { BaseSelectionDock, baseSelectionMapProps, baseSelectionOnSelect } from './screens/BaseSelectionScreen'
import { LandGrabDock, landGrabMapProps, landGrabOnSelect } from './screens/LandGrabScreen'
import { BattleDock, battleMapProps, battleOnSelect } from './screens/BattleScreen'
import { ResultsDock } from './screens/ResultsScreen'
import { AppShell } from './components/AppShell'
import { GameMap } from './components/map/GameMap'
import { PlayerRoster } from './components/PlayerRoster'
import { ConnectionBadge } from './components/ConnectionBadge'
import { MuteToggle } from './components/MuteToggle'
import { Toast } from './components/Toast'
import { KickConfirmModal } from './components/KickConfirmModal'
import { useGameTransitions } from './hooks/useGameTransitions'
import { findPlayer, playerDisplayName } from './lib/format'
import type { GameView, PlayerView } from './api/contracts'

function urlRoomCode(): string | null {
  const match = /^#\/room\/([A-Za-z0-9]{4})/.exec(window.location.hash)
  return match ? match[1].toUpperCase() : null
}

function isYourTurn(view: GameView): boolean {
  if (view.youAreCurrentPicker) return true
  if (view.pendingAttackTarget?.currentAttackerPlayerId === view.youPlayerId) return true
  const q = view.pendingQuestion
  if (q && q.participantPlayerIds.includes(view.youPlayerId) && !q.hasAnswered[view.youPlayerId]) return true
  return false
}

function phaseLabelKey(phase: GameView['phase']): string {
  switch (phase) {
    case 'BaseSelection':
      return 'app.phase.baseSelection'
    case 'LandGrab':
      return 'app.phase.landGrab'
    case 'Battle':
      return 'app.phase.battle'
    case 'Finished':
      return 'app.phase.gameOver'
    default:
      return ''
  }
}

function TopBar({ view }: { view: GameView }) {
  const { t } = useTranslation()
  const leaveGame = useGameStore((s) => s.leaveGame)
  const phaseKey = phaseLabelKey(view.phase)
  const roundsRemaining = Math.max(0, view.roundLimit - view.currentRound)
  const progressPercent = view.roundLimit > 0 ? Math.min(100, (view.currentRound / view.roundLimit) * 100) : 0

  async function onLeaveGame() {
    if (!window.confirm(t('app.leaveGameConfirm'))) return
    try {
      await leaveRoom()
    } finally {
      leaveGame()
    }
  }

  return (
    <>
      <h1>{t('app.title')}</h1>
      <span>&middot;</span>
      <span>{phaseKey && t(phaseKey)}</span>
      {view.phase === 'Battle' && (
        <>
          <span>&middot;</span>
          <span className="round-progress">
            <span className="round-flip-frame tabular-nums">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={view.currentRound}
                  initial={{ rotateX: -90, opacity: 0 }}
                  animate={{ rotateX: 0, opacity: 1 }}
                  exit={{ rotateX: 90, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
                  style={{ display: 'inline-block' }}
                >
                  {t('app.roundProgress', {
                    current: view.currentRound,
                    total: view.roundLimit,
                    remaining: roundsRemaining,
                  })}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="round-progress-track" aria-hidden="true">
              <span className="round-progress-fill" style={{ width: `${progressPercent}%` }} />
            </span>
          </span>
        </>
      )}
      <MuteToggle />
      {view.phase !== 'Finished' && (
        <button type="button" className="leave-game-button" onClick={() => void onLeaveGame()}>
          {t('app.leaveGame')}
        </button>
      )}
    </>
  )
}

function App() {
  const { t } = useTranslation()
  const status = useGameStore((s) => s.status)
  const closedReason = useGameStore((s) => s.closedReason)
  const kickedReason = useGameStore((s) => s.kickedReason)
  const session = useGameStore((s) => s.session)
  const view = useGameStore((s) => s.view)
  const gameView = useGameStore((s) => s.gameView)
  const previousGameView = useGameStore((s) => s.previousGameView)
  const applyView = useGameStore((s) => s.applyView)
  const setSession = useGameStore((s) => s.setSession)
  const [actionError, setActionError] = useState<string | null>(null)
  const [proclamation, setProclamation] = useState<string | null>(null)
  const [proclamationQueue, setProclamationQueue] = useState<string[]>([])
  const [mapShaking, setMapShaking] = useState(false)
  const [kickTarget, setKickTarget] = useState<PlayerView | null>(null)

  async function onConfirmKick(landPolicy: 'ReleaseLand' | 'BotTakeover') {
    if (!kickTarget) return
    const target = kickTarget
    setKickTarget(null)
    try {
      await kickPlayer(target.playerId, landPolicy)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('kick.kickFailed'))
    }
  }

  const transitions = useGameTransitions(gameView, previousGameView)

  // Enqueue every proclamation-worthy transition from this batch, in priority order - never just
  // the first match. useGameTransitions documents that one snapshot can carry several of these at
  // once (e.g. a base assault's final hit both captures a base and eliminates its owner); picking
  // only one and dropping the rest would silently lose whichever fired second.
  useEffect(() => {
    if (transitions.length === 0) return

    const messages: string[] = []

    const ownElimination = transitions.find((t) => t.kind === 'playerEliminated' && t.playerId === gameView?.youPlayerId)
    if (ownElimination) messages.push(t('app.ownEliminationProclamation'))

    const captured = transitions.find((t) => t.kind === 'baseCaptured')
    if (captured && captured.kind === 'baseCaptured' && gameView) {
      const defender = findPlayer(gameView, captured.defenderPlayerId)
      messages.push(t('app.baseFallsProclamation', { defenderName: playerDisplayName(defender) }))
    }

    if (messages.length > 0) {
      setProclamationQueue((prev) => [...prev, ...messages])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitions])

  // Drains proclamationQueue one message at a time: shows the next queued message only once
  // nothing is currently showing, so a fast follow-up batch queues up behind an in-progress
  // proclamation instead of cutting it off.
  useEffect(() => {
    if (proclamation !== null || proclamationQueue.length === 0) return
    const [next, ...rest] = proclamationQueue
    setProclamation(next)
    setProclamationQueue(rest)
    const id = window.setTimeout(() => setProclamation(null), 4000)
    return () => window.clearTimeout(id)
  }, [proclamationQueue, proclamation])

  // Map-shake feedback for base damage is independent of whichever proclamation (if any) also
  // fires from the same batch - a shake and a banner don't visually conflict.
  useEffect(() => {
    if (!transitions.some((t) => t.kind === 'baseDamaged')) return
    setMapShaking(true)
    const id = window.setTimeout(() => setMapShaking(false), 420)
    return () => window.clearTimeout(id)
  }, [transitions])

  useEffect(() => {
    const yourTurn = gameView !== null && gameView.phase !== 'Finished' && isYourTurn(gameView)
    document.title = yourTurn ? t('app.yourTurnTitle') : t('app.title')
    return () => {
      document.title = t('app.title')
    }
  }, [gameView, t])

  // Sustained (not edge-triggered) danger indicator: on for as long as the viewer's own base is
  // the target of another player's assault, distinct from the self-heal case (attacker === defender)
  // where nothing is actually at risk.
  const ownBaseUnderAssault =
    gameView?.battle?.kind === 'BaseAssault' &&
    gameView.battle.defenderPlayerId === gameView.youPlayerId &&
    gameView.battle.attackerPlayerId !== gameView.battle.defenderPlayerId

  const urlCode = urlRoomCode()
  const sessionUsable = session !== null && (!urlCode || urlCode === session.roomCode)

  const restoreAttempted = useAuthStore((s) => s.restoreAttempted)
  const authProfile = useAuthStore((s) => s.profile)
  const restoreSession = useAuthStore((s) => s.restoreSession)

  useEffect(() => {
    // Silent restore (player-accounts's "silently restored on a later visit") must resolve
    // *before* the hub connection opens - accessTokenFactory is only read at connect time, so a
    // connection opened first would negotiate anonymously and stay that way for its whole life
    // even once restoreSession() later populates an access token (see connection.ts's
    // reauthenticate for the other half of this - the just-signed-in-this-session case).
    void restoreSession().then(() => ensureConnected())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (status !== 'connected' || !sessionUsable || !session) return
    const name = localStorage.getItem('triviador.name') ?? ''
    joinRoom(session.roomCode, name, session.playerToken).then((result) => {
      if (result.success && result.view) {
        applyView(result.view)
      } else {
        setSession(null)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sessionUsable])

  const roomLanguage = gameView?.language ?? view?.language ?? null
  useEffect(() => {
    if (roomLanguage) applyRoomLanguage(roomLanguage)
  }, [roomLanguage])

  const currentActorKey = gameView
    ? [
        gameView.currentPickerPlayerId,
        gameView.pendingQuestion?.prompt.questionId,
        gameView.pendingRegionPick?.currentPickerPlayerId,
        gameView.pendingAttackTarget?.currentAttackerPlayerId,
      ].join('-')
    : ''
  useEffect(() => {
    setActionError(null)
  }, [currentActorKey])

  useEffect(() => {
    if (actionError === null) return
    const id = window.setTimeout(() => setActionError(null), 4000)
    return () => window.clearTimeout(id)
  }, [actionError])

  if (!sessionUsable || !view) {
    if (!restoreAttempted) {
      // Avoid flashing the signed-out landing screen before the silent-restore attempt resolves.
      return <ConnectionBadge status={status} closedReason={closedReason} kickedReason={kickedReason} />
    }
    if (authProfile && (authProfile.username === null || authProfile.avatarId === null)) {
      return (
        <>
          <ConnectionBadge status={status} closedReason={closedReason} kickedReason={kickedReason} />
          <AccountSetupScreen />
        </>
      )
    }
    return (
      <>
        <ConnectionBadge status={status} closedReason={closedReason} kickedReason={kickedReason} />
        <LandingScreen />
      </>
    )
  }

  if (!gameView) {
    return (
      <>
        <ConnectionBadge status={status} closedReason={closedReason} kickedReason={kickedReason} />
        <LobbyScreen />
      </>
    )
  }

  let mapProps: { interactive: boolean; eligibleRegionIds: readonly string[]; contestedRegionId: string | null } = {
    interactive: false,
    eligibleRegionIds: [],
    contestedRegionId: null,
  }
  let onSelect: ((regionId: string) => void) | undefined
  let dock: ReactNode
  let activePlayerId: string | null = null

  switch (gameView.phase) {
    case 'BaseSelection':
      mapProps = baseSelectionMapProps(gameView)
      onSelect = (id) => void baseSelectionOnSelect(gameView, id, setActionError)
      dock = <BaseSelectionDock view={gameView} />
      activePlayerId = gameView.currentPickerPlayerId
      break
    case 'LandGrab':
      mapProps = landGrabMapProps(gameView)
      onSelect = (id) => void landGrabOnSelect(gameView, id, setActionError)
      dock = <LandGrabDock view={gameView} onError={setActionError} />
      activePlayerId = gameView.pendingRegionPick?.currentPickerPlayerId ?? null
      break
    case 'Battle':
      mapProps = battleMapProps(gameView)
      onSelect = (id) => void battleOnSelect(gameView, id, setActionError)
      dock = <BattleDock view={gameView} onError={setActionError} />
      activePlayerId = gameView.pendingAttackTarget?.currentAttackerPlayerId ?? gameView.battle?.attackerPlayerId ?? null
      break
    case 'Finished':
    default:
      dock = <ResultsDock />
      break
  }

  const dockKey = [
    gameView.phase,
    gameView.currentRound,
    gameView.pendingQuestion?.prompt.questionId,
    gameView.pendingRegionPick?.currentPickerPlayerId,
    gameView.pendingAttackTarget?.currentAttackerPlayerId,
    gameView.pendingReveal?.prompt.questionId,
    gameView.pendingBasePick?.currentPickerPlayerId,
    gameView.lastReveal?.prompt.questionId ?? '',
    gameView.outcome ? 'outcome' : '',
  ]
    .filter((part) => part !== undefined && part !== null)
    .join('-')

  return (
    <>
      <ConnectionBadge status={status} closedReason={closedReason} kickedReason={kickedReason} />
      <AppShell
        dockKey={dockKey}
        mapShaking={mapShaking}
        mapDanger={ownBaseUnderAssault}
        topBar={<TopBar view={gameView} />}
        map={
          <GameMap
            view={gameView}
            interactive={mapProps.interactive}
            eligibleRegionIds={mapProps.eligibleRegionIds}
            contestedRegionId={mapProps.contestedRegionId}
            onSelect={onSelect}
          />
        }
        roster={
          <PlayerRoster
            view={gameView}
            activePlayerId={activePlayerId}
            youAreHost={view.youAreHost}
            viewerPlayerId={view.youPlayerId}
            onKick={setKickTarget}
          />
        }
        dock={
          <>
            <AnimatePresence>{proclamation && <Toast key="proclamation" message={proclamation} tone="info" />}</AnimatePresence>
            <AnimatePresence>{actionError && <Toast key="action-error" message={actionError} />}</AnimatePresence>
            {dock}
          </>
        }
      />
      <KickConfirmModal
        open={kickTarget !== null}
        targetName={playerDisplayName(kickTarget)}
        requireLandPolicy
        onCancel={() => setKickTarget(null)}
        onConfirm={(policy) => void onConfirmKick(policy)}
      />
    </>
  )
}

export default App
