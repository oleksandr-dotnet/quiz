import { useState } from 'react'
import { createSandboxRoom } from '../api/commands'
import { fastForwardToBattle, passCurrentTurn } from '../lib/sandbox'
import { useGameStore } from '../store/gameStore'
import './TestMechanicsScreen.css'

interface Scenario {
  id: string
  title: string
  description: string
  hint: string
  botCount: number
  afterCreate?: () => Promise<void>
}

const SCENARIOS: Scenario[] = [
  {
    id: 'attack-outcome',
    title: '⚔️ I attack bot territory',
    description: 'Jumps straight to Battle phase, already your turn to pick a target.',
    hint: 'Click any bot region on the map to attack it, then use the panel’s "Correct"/"Incorrect" buttons to decide who wins - try both an attacker win and an attacker loss.',
    botCount: 1,
    afterCreate: () => fastForwardToBattle(),
  },
  {
    id: 'defend-outcome',
    title: '🛡️ Bot attacks my territory',
    description: 'Skips your own first turn and hands the attack to the bot.',
    hint: 'The bot will pick one of your regions. Use the panel to force the outcome and see both a successful defense and a lost region.',
    botCount: 1,
    afterCreate: async () => {
      await fastForwardToBattle()
      await passCurrentTurn()
    },
  },
  {
    id: 'base-assault',
    title: '🏰 Base assault - all combinations',
    description: 'Jumps to Battle phase; base assaults are unlocked from round 1 in sandbox (round 8 in a real game).',
    hint: 'Use "Find a base to assault" to let territory shuffle until an enemy base is reachable, then attack it and force each hit’s outcome - watch base HP, the score swing, and the eventual capture/elimination.',
    botCount: 1,
    afterCreate: () => fastForwardToBattle(),
  },
  {
    id: 'streaks',
    title: '🔥 Answer streaks',
    description: 'Jumps to Battle phase. Streaks build on any consecutive correct answer, in any phase.',
    hint: 'Repeatedly attack and force yourself correct (auto-pick a target, then "Correct") and watch your streak and its compounding bonus grow in the scoreboard at the top of the panel.',
    botCount: 1,
    afterCreate: () => fastForwardToBattle(),
  },
  {
    id: 'golden',
    title: '🌟 Golden question',
    description: 'Golden questions are eligible on every question in sandbox (~35% chance each, vs. spaced out in a real game).',
    hint: 'Keep progressing questions (fast-forward, attack, or force answers) - a golden question’s reveal is called out, and every effect it touches (region awards, score bonus, heal, streak) doubles.',
    botCount: 1,
  },
  {
    id: 'freeplay',
    title: '🧪 Free play',
    description: 'A fresh sandbox game with no fast-forwarding - play every phase yourself.',
    hint: 'Play normally (category ban, base picks, land grab, battle) with the panel always available for no-time-limit, force-any-outcome control whenever you want it.',
    botCount: 1,
  },
]

export function TestMechanicsScreen() {
  const [started, setStarted] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const setSession = useGameStore((s) => s.setSession)
  const applyView = useGameStore((s) => s.applyView)

  async function launch(scenario: Scenario) {
    setBusyId(scenario.id)
    setError(null)
    try {
      const result = await createSandboxRoom(scenario.botCount)
      if (!result.success || !result.view || !result.roomCode || !result.playerToken) {
        setError(result.rejectionReason ?? 'Could not create sandbox room.')
        return
      }
      setSession({ roomCode: result.roomCode, playerToken: result.playerToken, isSandbox: true })
      applyView(result.view)
      if (scenario.afterCreate) await scenario.afterCreate()
      // A full navigation, not just a hash change - the room's hash route (App.tsx's urlRoomCode)
      // is only live on the root path, and this screen is served from /test-mechanics. The session
      // just saved above (setSession, sessionStorage-backed) survives the reload and reconnects.
      window.location.assign(`/#/room/${result.roomCode}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create sandbox room.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="test-mechanics-screen">
      <div className="test-mechanics-card">
        <h1>Test Mechanics</h1>
        <p className="test-mechanics-tagline">
          A developer playground for every game mechanic: no time limits, no need to know trivia
          answers, full control over who answers correctly and who doesn't.
        </p>

        {!started ? (
          <button type="button" className="primary" onClick={() => setStarted(true)} data-testid="test-mechanics-start">
            Test mechanics
          </button>
        ) : (
          <div className="test-mechanics-list">
            {SCENARIOS.map((s) => (
              <div key={s.id} className="test-mechanics-scenario" data-testid={`scenario-${s.id}`}>
                <h2>{s.title}</h2>
                <p>{s.description}</p>
                <p className="test-mechanics-hint">{s.hint}</p>
                <button type="button" disabled={busyId !== null} onClick={() => void launch(s)}>
                  {busyId === s.id ? 'Starting…' : 'Launch'}
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="test-mechanics-error">{error}</p>}
        <a className="test-mechanics-back" href="/">
          ← Back to the game
        </a>
      </div>
    </main>
  )
}
