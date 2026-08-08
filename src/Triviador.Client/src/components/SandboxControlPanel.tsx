import { useState } from 'react'
import { forceAnswer, forceExpire, leaveRoom } from '../api/commands'
import { advanceOneStep, fastForwardToBattle, huntForBaseTarget, passCurrentTurn } from '../lib/sandbox'
import { findPlayer, playerDisplayName } from '../lib/format'
import { useGameStore } from '../store/gameStore'
import type { GameView } from '../api/contracts'
import './SandboxControlPanel.css'

function battleLabel(view: GameView): string {
  const battle = view.battle
  if (!battle) return 'Land-grab question'
  if (battle.attackerPlayerId === battle.defenderPlayerId) return 'Self-heal'
  if (battle.isTiebreakRound) return 'Numeric tiebreak'
  if (battle.kind === 'BaseAssault') {
    const hit = (battle.assaultQuestionIndex ?? 0) + 1
    return `Base assault - hit ${hit}`
  }
  const region = view.regions.find((r) => r.regionId === battle.contestedRegionId)
  return `Duel over ${region?.name ?? battle.contestedRegionId}`
}

// Floating, always-on-top debug panel rendered by App.tsx only when the active session was created
// through /test-mechanics (see TestMechanicsScreen). Everything below is built from two generic
// server primitives - forceExpire/forceAnswer - plus the orchestration helpers in lib/sandbox.ts;
// there is no scenario-specific server logic to keep in sync with this UI.
export function SandboxControlPanel({ view }: { view: GameView }) {
  const [collapsed, setCollapsed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const leaveGame = useGameStore((s) => s.leaveGame)

  // `action` may return a string to leave as the final status message (e.g. a hunt's outcome) -
  // returning nothing clears the status back to idle once it resolves.
  async function run(label: string, action: () => Promise<string | void>) {
    if (busy) return
    setBusy(true)
    setStatus(label)
    try {
      const finalStatus = await action()
      setStatus(finalStatus ?? null)
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'action failed'}`)
    } finally {
      setBusy(false)
    }
  }

  async function onExit() {
    try {
      await leaveRoom()
    } finally {
      leaveGame()
      // A full navigation, not SPA-internal state - simplest way back to the launcher and avoids
      // any risk of stale sandbox-only state (this panel, forced-answer button state) surviving
      // into whatever the visitor does next.
      window.location.href = '/test-mechanics'
    }
  }

  const q = view.pendingQuestion
  const activePlayers = view.players.filter((p) => !p.eliminated && !p.withdrawn)

  return (
    <div className={`sandbox-panel${collapsed ? ' sandbox-panel-collapsed' : ''}`} data-testid="sandbox-panel">
      <div className="sandbox-panel-header">
        <span className="sandbox-panel-title">🧪 Sandbox</span>
        <span className="sandbox-panel-phase">
          {view.phase}
          {view.phase === 'Battle' ? ` · round ${view.currentRound}/${view.roundLimit}` : ''}
        </span>
        <button type="button" className="sandbox-panel-collapse" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? '▲' : '▼'}
        </button>
        <button type="button" className="sandbox-panel-exit" onClick={() => void onExit()}>
          Exit
        </button>
      </div>

      {!collapsed && (
        <div className="sandbox-panel-body">
          <div className="sandbox-scoreboard">
            {view.players.map((p) => (
              <div key={p.playerId} className="sandbox-scoreboard-row">
                <span>
                  {playerDisplayName(p)}
                  {p.playerId === view.youPlayerId ? ' (you)' : ''}
                  {p.eliminated ? ' 💀' : ''}
                </span>
                <span className="sandbox-scoreboard-stats">
                  {p.score} pts
                  {p.baseHitPoints !== null ? ` · ${p.baseHitPoints} HP` : ''}
                  {p.answerStreak > 0 ? ` · 🔥${p.answerStreak}` : ''}
                </span>
              </div>
            ))}
          </div>

          {view.outcome && (
            <div className="sandbox-section">
              <p className="sandbox-hint">
                Game over - winner(s):{' '}
                {view.outcome.winnerPlayerIds.map((id) => playerDisplayName(findPlayer(view, id))).join(', ')}
              </p>
            </div>
          )}

          {q && (
            <div className="sandbox-section">
              <p className="sandbox-section-title">{battleLabel(view)}</p>
              {q.participantPlayerIds.map((playerId) => {
                const player = findPlayer(view, playerId)
                const answered = q.hasAnswered[playerId]
                return (
                  <div key={playerId} className="sandbox-force-row">
                    <span>
                      {playerDisplayName(player)}
                      {playerId === view.youPlayerId ? ' (you)' : ''}
                      {answered ? ' ✓ answered' : ''}
                    </span>
                    <span className="sandbox-force-buttons">
                      <button
                        type="button"
                        disabled={busy || answered}
                        onClick={() => run(`Forcing ${playerDisplayName(player)} correct...`, () => forceAnswer(playerId, true))}
                      >
                        ✅ Correct
                      </button>
                      <button
                        type="button"
                        disabled={busy || answered}
                        onClick={() => run(`Forcing ${playerDisplayName(player)} incorrect...`, () => forceAnswer(playerId, false))}
                      >
                        ❌ Incorrect
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {!q && view.pendingReveal && (
            <div className="sandbox-section">
              <p className="sandbox-section-title">Reveal is holding</p>
              <button type="button" disabled={busy} onClick={() => run('Resolving reveal...', () => forceExpire())}>
                ⏩ Resolve reveal now
              </button>
            </div>
          )}

          {!q && !view.pendingReveal && view.pendingAttackTarget && (
            <div className="sandbox-section">
              <p className="sandbox-section-title">
                {playerDisplayName(findPlayer(view, view.pendingAttackTarget.currentAttackerPlayerId))}
                {view.pendingAttackTarget.currentAttackerPlayerId === view.youPlayerId
                  ? ' - your turn to pick a target on the map'
                  : "'s turn to pick a target"}
              </p>
              <div className="sandbox-button-row">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run('Auto-picking target...', () => advanceOneStep('best'))}
                >
                  ⏩ Auto-pick target
                </button>
                <button type="button" disabled={busy} onClick={() => run('Passing turn...', () => passCurrentTurn())}>
                  ⏭ Pass turn (no capture)
                </button>
              </div>
            </div>
          )}

          {!q && !view.pendingReveal && (view.pendingBasePick || view.pendingRegionPick || view.pendingCategoryBan) && (
            <div className="sandbox-section">
              <p className="sandbox-section-title">
                {view.pendingBasePick && 'Base selection in progress'}
                {view.pendingRegionPick && 'Land-grab pick in progress'}
                {view.pendingCategoryBan && 'Category-ban draft in progress'}
              </p>
              <p className="sandbox-hint">Click the map/options as usual, or skip ahead:</p>
              <button type="button" disabled={busy} onClick={() => run('Skipping...', () => forceExpire())}>
                ⏩ Skip / auto-resolve
              </button>
            </div>
          )}

          {(view.phase === 'CategoryBan' || view.phase === 'BaseSelection' || view.phase === 'LandGrab') && (
            <div className="sandbox-section">
              <button
                type="button"
                disabled={busy}
                onClick={() => run('Fast-forwarding to Battle...', () => fastForwardToBattle())}
              >
                ⏭ Fast-forward to Battle
              </button>
            </div>
          )}

          {view.phase === 'Battle' && !view.outcome && (
            <div className="sandbox-section">
              <p className="sandbox-section-title">Find a base to assault</p>
              <div className="sandbox-button-row">
                {activePlayers.map((p) => (
                  <button
                    key={p.playerId}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(`Hunting a base target for ${playerDisplayName(p)}...`, async () => {
                        const result = await huntForBaseTarget(p.playerId)
                        return result === 'ready'
                          ? `${playerDisplayName(p)} can now target an enemy base - pick it on the map (or wait for their turn).`
                          : result === 'game-over'
                            ? 'Game ended before a base target opened up.'
                            : 'Gave up after 80 turns - no base adjacency opened up. Try again or keep playing manually.'
                      })
                    }
                  >
                    🎯 {playerDisplayName(p)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {status && <p className="sandbox-status">{status}</p>}
        </div>
      )}
    </div>
  )
}
