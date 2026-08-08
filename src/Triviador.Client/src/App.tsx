import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import { CategoryBanDock } from './screens/CategoryBanScreen'
import { CategoryBanResultPopup } from './components/CategoryBanResultPopup'
import { BaseSelectionDock, baseSelectionMapProps, baseSelectionOnSelect } from './screens/BaseSelectionScreen'
import { LandGrabDock, landGrabMapProps, landGrabOnSelect } from './screens/LandGrabScreen'
import { BattleDock, battleMapProps, battleOnSelect } from './screens/BattleScreen'
import { ResultsDock } from './screens/ResultsScreen'
import { RecapScreen } from './screens/RecapScreen'
import { MyRecapsScreen } from './screens/MyRecapsScreen'
import { TestMechanicsScreen } from './screens/TestMechanicsScreen'
import { AppShell } from './components/AppShell'
import { SandboxControlPanel } from './components/SandboxControlPanel'
import { GameMap } from './components/map/GameMap'
import { PlayerRoster } from './components/PlayerRoster'
import { TurnAnnouncement } from './components/TurnAnnouncement'
import { ConnectionBadge } from './components/ConnectionBadge'
import { MuteToggle } from './components/MuteToggle'
import { EmoteButton } from './components/EmoteButton'
import { AppMenu } from './components/AppMenu'
import { Toast } from './components/Toast'
import { KickConfirmModal } from './components/KickConfirmModal'
import { LeaveGameConfirmModal } from './components/LeaveGameConfirmModal'
import { useGameTransitions } from './hooks/useGameTransitions'
import { useIsDesktop } from './hooks/useIsDesktop'
import { useLandGrabReveal } from './hooks/useLandGrabReveal'
import { findPlayer, playerDisplayName } from './lib/format'
import { BASE_ASSAULT_SCORE_BONUS } from './lib/gameRules'
import { categoryEmoji } from './lib/categoryEmojis'
import { playStreakMilestone } from './lib/sound'
import type { GameView, PlayerView } from './api/contracts'

function urlRoomCode(): string | null {
  const match = /^#\/room\/([A-Za-z0-9]{4})/.exec(window.location.hash)
  return match ? match[1].toUpperCase() : null
}

// Real path routes (not `#/...` hash routes like urlRoomCode above) - a shared recap link must
// work without JS for its OG meta tags (see the server-side shell route), and /recaps has no
// reason to be hash-based either. Checked before any of the session/room bootstrap logic below, so
// a recap link never gets swallowed by the landing/lobby flow.
function urlRecapId(): string | null {
  const match = /^\/recap\/([0-9a-fA-F-]{36})$/.exec(window.location.pathname)
  return match ? match[1] : null
}

function isMyRecapsRoute(): boolean {
  return window.location.pathname === '/recaps'
}

// A developer-only playground (see components/SandboxControlPanel.tsx) - real path route like
// /recaps above, checked at the same tier so it never gets swallowed by the landing/lobby flow.
function isTestMechanicsRoute(): boolean {
  return window.location.pathname === '/test-mechanics'
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
    case 'CategoryBan':
      return 'app.phase.categoryBan'
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

// requestLeave opens the shared LeaveGameConfirmModal, which App() renders as a sibling of
// AppShell (alongside KickConfirmModal) rather than in here - see App()'s own comment on why that
// placement matters: nested inside AppShell's topBar slot, a position:fixed modal gets trapped
// inside .hud-top's stacking context (App.css sets .hud-top to z-index 40, one level below
// .shell-dock's 45), so its own z-index would only win locally within .hud-top and the whole modal
// would paint - and hit-test - behind the in-game question card instead of above it.
function TopBar({ view, requestLeave }: { view: GameView; requestLeave: () => void }) {
  const { t } = useTranslation()
  const phaseKey = phaseLabelKey(view.phase)
  const roundsRemaining = Math.max(0, view.roundLimit - view.currentRound)
  const progressPercent = view.roundLimit > 0 ? Math.min(100, (view.currentRound / view.roundLimit) * 100) : 0
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      {/* Desktop/tablet top bar - hidden on mobile (App.css mobile breakpoint), where its content
          replaced by .top-bar-mobile-menu below since there's no room for it without wrapping. */}
      <div className="top-bar-full">
        <h1>{t('app.title')}</h1>
        <span>&middot;</span>
        <span className="phase-label">{phaseKey && t(phaseKey)}</span>
        {view.bannedCategories.length > 0 && (
          <span
            className="banned-categories-badge"
            title={t('categoryBan.bannedTooltip', { categories: view.bannedCategories.join(', ') })}
            aria-label={t('categoryBan.bannedTooltip', { categories: view.bannedCategories.join(', ') })}
          >
            🚫{' '}
            {view.bannedCategories.map((c) => (
              <span key={c} aria-hidden="true">
                {categoryEmoji(c)}
              </span>
            ))}
          </span>
        )}
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
        <EmoteButton />
        <MuteToggle />
        {view.phase !== 'Finished' && (
          <button type="button" className="leave-game-button" onClick={requestLeave}>
            {t('app.leaveGame')}
          </button>
        )}
      </div>

      {/* Mobile-only corner menu - hidden on desktop (App.css). Bundles sound + leave-game, the
          two actions the full top bar exposes, behind one small button instead of a wrapping row. */}
      <div className="top-bar-mobile-menu">
        <EmoteButton />
        <button
          type="button"
          className="menu-button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={t('app.menu')}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          data-testid="app-menu-button"
        >
          &#9776;
        </button>
        {menuOpen && (
          <AppMenu
            onClose={() => setMenuOpen(false)}
            onLeaveGame={
              view.phase !== 'Finished'
                ? () => {
                    setMenuOpen(false)
                    requestLeave()
                  }
                : null
            }
          />
        )}
      </div>
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
  const leaveGame = useGameStore((s) => s.leaveGame)
  // urlRoomCode() reads window.location.hash directly wherever it's called - fine for a fresh page
  // load (an invite link always opens one), but a hash-only change in an already-open tab (pasting
  // a link into the address bar, or a same-page anchor) fires no React re-render on its own. This
  // tick forces one so that case still lands the visitor in invite mode rather than the generic
  // landing screen with a stale read of the old hash.
  const [, forceHashTick] = useState(0)
  useEffect(() => {
    const onHashChange = () => forceHashTick((n) => n + 1)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const [actionError, setActionError] = useState<string | null>(null)
  const [proclamation, setProclamation] = useState<string | null>(null)
  const [proclamationQueue, setProclamationQueue] = useState<string[]>([])
  const [mapShaking, setMapShaking] = useState(false)
  const [kickTarget, setKickTarget] = useState<PlayerView | null>(null)
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const [bannedCategoriesResult, setBannedCategoriesResult] = useState<string[] | null>(null)
  // Shared with LandGrabDock (same hook, same window) purely to know when a reveal is on screen -
  // AppShell uses it to hide the map on mobile while it's up (see mapHiddenMobile below).
  const landGrabVisibleReveal = useLandGrabReveal(gameView)
  const isDesktop = useIsDesktop()

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

  async function onConfirmLeaveGame() {
    setConfirmingLeave(false)
    try {
      await leaveRoom()
    } finally {
      leaveGame()
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

    const scoreAdjusted = transitions.find((t) => t.kind === 'baseAssaultScoreAdjusted')
    if (scoreAdjusted && scoreAdjusted.kind === 'baseAssaultScoreAdjusted' && gameView) {
      const you = gameView.youPlayerId
      if (scoreAdjusted.winnerPlayerId === you) {
        messages.push(t('app.baseAssaultBonusWonProclamation', { amount: BASE_ASSAULT_SCORE_BONUS }))
      } else if (scoreAdjusted.loserPlayerId === you) {
        messages.push(t('app.baseAssaultBonusLostProclamation', { amount: BASE_ASSAULT_SCORE_BONUS }))
      }
    }

    const duelDefended = transitions.find((t) => t.kind === 'duelDefenseScoreAwarded')
    if (duelDefended && duelDefended.kind === 'duelDefenseScoreAwarded' && gameView) {
      if (duelDefended.defenderPlayerId === gameView.youPlayerId) {
        messages.push(t('app.duelDefenseBonusProclamation', { amount: BASE_ASSAULT_SCORE_BONUS }))
      }
    }

    // A room-wide, escalating callout (see streak-callouts) - shown to everyone, not just the
    // streaking player, since the point is a shared moment at the table, not a private notification.
    const streakMilestone = transitions.find((t) => t.kind === 'streakMilestone')
    if (streakMilestone && streakMilestone.kind === 'streakMilestone' && gameView) {
      const player = findPlayer(gameView, streakMilestone.playerId)
      messages.push(t(`app.streakMilestoneProclamation.tier${streakMilestone.tier}`, { playerName: playerDisplayName(player) }))
      playStreakMilestone(streakMilestone.tier)
    }

    if (messages.length > 0) {
      setProclamationQueue((prev) => [...prev, ...messages])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitions])

  // A floating, non-blocking popup (not the proclamation queue - base selection starts the instant
  // this fires, and that's a live, time-limited activity the player shouldn't be locked out of).
  useEffect(() => {
    const banResolved = transitions.find((t) => t.kind === 'categoryBansResolved')
    if (banResolved && banResolved.kind === 'categoryBansResolved') {
      setBannedCategoriesResult(banResolved.categories)
    }
  }, [transitions])

  // Drains proclamationQueue one message at a time: shows the next queued message only once
  // nothing is currently showing, so a fast follow-up batch queues up behind an in-progress
  // proclamation instead of cutting it off.
  useEffect(() => {
    if (proclamation !== null || proclamationQueue.length === 0) return
    const [next, ...rest] = proclamationQueue
    setProclamation(next)
    setProclamationQueue(rest)
  }, [proclamationQueue, proclamation])

  // Auto-dismiss, kept in its own effect keyed only on `proclamation`. Sharing the dequeue effect
  // above would re-run this on the very state update that shows the message (proclamation:
  // null -> next), and the cleanup from that stale run would clear the timeout it had just armed
  // before it ever fired - the toast would then sit on screen until a *different* message replaced
  // it, never on its own.
  useEffect(() => {
    if (proclamation === null) return
    const id = window.setTimeout(() => setProclamation(null), 4000)
    return () => window.clearTimeout(id)
  }, [proclamation])

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

  // Invite-link auto-join: a visitor who opens #/room/XXXX and is already signed in with a
  // complete profile should land straight in the lobby, no manual "Join" click needed - that
  // click-free case is only possible here (LandingScreen has no session/profile to auto-act on
  // yet when it first renders). A signed-out or not-yet-set-up visitor still needs a user gesture
  // to establish who they are, so they fall through to LandingScreen's own invite-mode UI instead.
  const autoJoinAttemptedFor = useRef<string | null>(null)
  const [autoJoining, setAutoJoining] = useState(false)
  const [autoJoinError, setAutoJoinError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'connected' || sessionUsable || !urlCode) return
    if (!authProfile || authProfile.username === null || authProfile.avatarId === null) return
    if (autoJoinAttemptedFor.current === urlCode) return
    autoJoinAttemptedFor.current = urlCode
    setAutoJoining(true)
    setAutoJoinError(null)
    joinRoom(urlCode, authProfile.username, null).then((result) => {
      setAutoJoining(false)
      if (result.success && result.view && result.roomCode && result.playerToken) {
        setSession({ roomCode: result.roomCode, playerToken: result.playerToken })
        applyView(result.view)
      } else {
        setAutoJoinError(result.rejectionReason ?? t('landing.errorGeneric'))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sessionUsable, urlCode, authProfile])

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

  // Checked ahead of the session/lobby bootstrap below - a shared recap link or the recap list must
  // render regardless of whether the visitor has (or wants) an active room session.
  const recapId = urlRecapId()
  if (recapId) {
    return <RecapScreen id={recapId} />
  }
  if (isMyRecapsRoute()) {
    return <MyRecapsScreen />
  }
  if (isTestMechanicsRoute()) {
    return <TestMechanicsScreen />
  }

  if (!sessionUsable || !view) {
    if (!restoreAttempted) {
      // Avoid flashing the signed-out landing screen before the silent-restore attempt resolves.
      return <ConnectionBadge status={status} closedReason={closedReason} kickedReason={kickedReason} />
    }
    if (autoJoining) {
      return (
        <>
          <ConnectionBadge status={status} closedReason={closedReason} kickedReason={kickedReason} />
          <main className="landing paper-card">
            <div className="landing-brand">
              <h1>{t('app.title')}</h1>
              <p className="landing-tagline">{t('landing.joiningRoom', { code: urlCode })}</p>
            </div>
          </main>
        </>
      )
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
        <AnimatePresence>{autoJoinError && <Toast key="auto-join-error" message={autoJoinError} />}</AnimatePresence>
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
    case 'CategoryBan':
      dock = <CategoryBanDock view={gameView} onError={setActionError} />
      break
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

  const showingReveal =
    gameView.phase === 'Battle' ? gameView.pendingReveal !== null : landGrabVisibleReveal !== null
  // Also hide the map while a question's answer options are up (not just its reveal) - a land-grab
  // or battle question dock is just as tall as a reveal, and the map behind it was squished to the
  // same unreadable sliver (see mapHiddenMobile's doc comment on AppShell). pendingQuestion is only
  // ever populated during those two phases' "answering" sub-state, never during the interactive
  // map-picking sub-states (base pick, region pick, attack target) that this must leave alone.
  const mapHiddenMobile = showingReveal || gameView.pendingQuestion !== null

  return (
    <>
      <ConnectionBadge status={status} closedReason={closedReason} kickedReason={kickedReason} />
      <TurnAnnouncement view={gameView} />
      <AnimatePresence>
        {bannedCategoriesResult && (
          <CategoryBanResultPopup
            key="category-ban-result"
            categories={bannedCategoriesResult}
            onDismiss={() => setBannedCategoriesResult(null)}
          />
        )}
      </AnimatePresence>
      <AppShell
        dockKey={dockKey}
        mapShaking={mapShaking}
        mapDanger={ownBaseUnderAssault}
        mapHiddenMobile={mapHiddenMobile}
        topBar={<TopBar view={gameView} requestLeave={() => setConfirmingLeave(true)} />}
        map={
          <GameMap
            view={gameView}
            interactive={mapProps.interactive}
            eligibleRegionIds={mapProps.eligibleRegionIds}
            contestedRegionId={mapProps.contestedRegionId}
            onSelect={onSelect}
            showDecorative={isDesktop}
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
      {/* Rendered here, as a sibling of AppShell, not inside TopBar/AppShell's topBar slot - see
          TopBar's own comment. .hud-top (App.css, z-index 40) sits below .shell-dock (z-index 45),
          so a fixed-position modal nested inside it would have its own z-index evaluated only
          within .hud-top's local stacking context and could be hit-tested behind an in-game
          question card instead of above it, exactly like KickConfirmModal already avoids by living
          out here. */}
      <LeaveGameConfirmModal
        open={confirmingLeave}
        onCancel={() => setConfirmingLeave(false)}
        onConfirm={() => void onConfirmLeaveGame()}
      />
      {session?.isSandbox && <SandboxControlPanel view={gameView} />}
    </>
  )
}

export default App
