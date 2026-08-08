import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useGameStore } from '../store/gameStore'
import { REGION_GEOMETRY } from './map/abstractGeography'

// The real 18-territory map (same geometry the live GameMap renders), fought over by 4 bot
// colonies in an endless loop - no questions, no HUD, no text, just the land-grab/battle map
// itself, blurred, standing in for the "a game happening" reference the user asked for.

const REGION_IDS = Object.keys(REGION_GEOMETRY)

// Straight from src/UI/Triviador.Web/Data/map.json's per-region adjacentTo lists (already
// symmetric in the source data) - the same graph the engine plays land-grab/battle on, hand-copied
// here since this decorative sim runs with no server connection to fetch it from.
const ADJACENCY: Record<string, string[]> = {
  r01: ['r02', 'r07'],
  r02: ['r01', 'r03', 'r08'],
  r03: ['r02', 'r04', 'r09'],
  r04: ['r03', 'r05', 'r10'],
  r05: ['r04', 'r06', 'r11'],
  r06: ['r05', 'r12'],
  r07: ['r01', 'r08', 'r13'],
  r08: ['r02', 'r07', 'r09', 'r14'],
  r09: ['r03', 'r08', 'r10', 'r15'],
  r10: ['r04', 'r09', 'r11', 'r16'],
  r11: ['r05', 'r10', 'r12', 'r17'],
  r12: ['r06', 'r11', 'r18'],
  r13: ['r07', 'r14'],
  r14: ['r08', 'r13', 'r15'],
  r15: ['r09', 'r14', 'r16'],
  r16: ['r10', 'r15', 'r17'],
  r17: ['r11', 'r16', 'r18'],
  r18: ['r12', 'r17'],
}

const BOT_COUNT = 4
const STEP_MS = 420

type Ownership = Record<string, number>

function randomInt(n: number): number {
  return Math.floor(Math.random() * n)
}

// A quick multi-source flood fill from 4 random seed regions - stands in for a finished land-grab
// phase, four roughly-equal contiguous territories rather than a random scatter of single cells.
function partitionMap(): Ownership {
  const owner: Ownership = {}
  const pool = [...REGION_IDS]
  const frontiers: string[][] = []
  for (let bot = 0; bot < BOT_COUNT; bot++) {
    const seed = pool.splice(randomInt(pool.length), 1)[0]
    owner[seed] = bot
    frontiers.push([seed])
  }

  let remaining = REGION_IDS.length - BOT_COUNT
  let progressed = true
  while (remaining > 0 && progressed) {
    progressed = false
    for (let bot = 0; bot < BOT_COUNT; bot++) {
      const frontier = frontiers[bot]
      for (let i = 0; i < frontier.length; i++) {
        const free = ADJACENCY[frontier[i]].find((n) => owner[n] === undefined)
        if (free) {
          owner[free] = bot
          frontier.push(free)
          remaining--
          progressed = true
          break
        }
      }
    }
  }
  // Disconnected leftovers can't happen on this map's graph, but fall back to a random owner
  // rather than leaving a region undefined if the graph above is ever edited.
  for (const id of REGION_IDS) {
    if (owner[id] === undefined) owner[id] = randomInt(BOT_COUNT)
  }
  return owner
}

// One skirmish: a random contested border region (adjacent to at least one different owner)
// flips to one of its attacking neighbors' color - the same "capture a bordering territory" shape
// as the real game's duels, just unattended and continuous.
function stepBattle(owner: Ownership): Ownership {
  const contested = REGION_IDS.filter((id) => ADJACENCY[id].some((n) => owner[n] !== owner[id]))
  if (contested.length === 0) return owner
  const target = contested[randomInt(contested.length)]
  const attackers = ADJACENCY[target].filter((n) => owner[n] !== owner[target])
  const attacker = attackers[randomInt(attackers.length)]
  return { ...owner, [target]: owner[attacker] }
}

function distinctOwners(owner: Ownership): number {
  return new Set(Object.values(owner)).size
}

// Mounted once at the app root (main.tsx), not per-screen - it self-gates on gameView so it's the
// pre-game backdrop (landing, account setup, lobby) and disappears the moment a real match starts,
// where the actual map is the game's visual centerpiece instead.
export function AmbientBattleBackground() {
  const inGame = useGameStore((s) => s.gameView !== null)
  const reducedMotion = usePrefersReducedMotion()
  const [owner, setOwner] = useState<Ownership>(partitionMap)
  const ownerRef = useRef(owner)
  ownerRef.current = owner

  useEffect(() => {
    if (inGame || reducedMotion) return
    const id = window.setInterval(() => {
      setOwner((current) => (distinctOwners(current) <= 1 ? partitionMap() : stepBattle(current)))
    }, STEP_MS)
    return () => window.clearInterval(id)
  }, [inGame, reducedMotion])

  if (inGame) return null

  return (
    <div className="ambient-battle-backdrop" aria-hidden="true">
      <svg viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid slice">
        {/* The 18 region paths below don't reach the viewBox's own edges (they leave room for the
            real map's terra-incognita ring, which this decorative sim never draws) - harmless on a
            desktop-wide viewport, where slice's crop stays close to the full 1200x640 frame, but a
            portrait phone's slice crops a narrow *vertical* strip through the map's width while
            still mapping the *entire* 0-640 height onto the screen, so the screen's top/bottom
            reliably land in that undrawn ring - confirmed live: raw --table-950 showing through
            solid black near both edges on a 393x852 viewport. Same fallback-fill technique the real
            map already uses for the same reason (see --terra-fallback's own definition in
            tokens.css) so every crop of this backdrop is fully painted, never gapped. */}
        <rect x="0" y="0" width="1200" height="640" fill="var(--terra-fallback)" />
        {REGION_IDS.map((id) => (
          <path
            key={id}
            d={REGION_GEOMETRY[id].path}
            className="ambient-battle-region"
            style={{ fill: `var(--seat-${owner[id]})` }}
          />
        ))}
      </svg>
    </div>
  )
}
