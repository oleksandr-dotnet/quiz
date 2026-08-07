import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useGameStore } from '../store/gameStore'

// A low-res Conway's Game of Life grid, rendered small and blown up with a heavy CSS blur - the
// user's own reference ("some animation of life happening, blurred a bit"). Colonies inherit the
// plurality color of the neighbors that birthed them, so patches drift and spread the way the
// game's own land-grab claims territory, rather than flickering as unrelated single pixels.
const COLS = 72
const ROWS = 40
const STEP_MS = 220
const ALIVE_FRACTION = 0.24
// Re-seed once a generation dies down this far - an empty/near-empty board would otherwise sit
// static (or nearly so) for the rest of the session once the automaton stabilizes or dies out.
const RESEED_BELOW_FRACTION = 0.015

// Straight from theme/tokens.css's gilt/seat palette, so the drifting colonies read as the same
// heraldic material as the rest of the game rather than a generic tech backdrop.
const PALETTE = ['#d9b45a', '#b58a2b', '#d4382f', '#345ca3', '#488e4e', '#b87e1c']

interface Grid {
  alive: Uint8Array
  color: Uint8Array
}

function seedGrid(): Grid {
  const alive = new Uint8Array(COLS * ROWS)
  const color = new Uint8Array(COLS * ROWS)
  for (let i = 0; i < alive.length; i++) {
    if (Math.random() < ALIVE_FRACTION) {
      alive[i] = 1
      color[i] = Math.floor(Math.random() * PALETTE.length)
    }
  }
  return { alive, color }
}

function step({ alive, color }: Grid): Grid {
  const nextAlive = new Uint8Array(COLS * ROWS)
  const nextColor = new Uint8Array(COLS * ROWS)
  const neighborColorCounts = new Array<number>(PALETTE.length)

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const idx = y * COLS + x
      let neighbors = 0
      neighborColorCounts.fill(0)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nIdx = ((y + dy + ROWS) % ROWS) * COLS + ((x + dx + COLS) % COLS)
          if (alive[nIdx]) {
            neighbors++
            neighborColorCounts[color[nIdx]]++
          }
        }
      }

      const wasAlive = alive[idx] === 1
      if (wasAlive && (neighbors === 2 || neighbors === 3)) {
        nextAlive[idx] = 1
        nextColor[idx] = color[idx]
      } else if (!wasAlive && neighbors === 3) {
        nextAlive[idx] = 1
        let bestColor = 0
        let bestCount = -1
        for (let c = 0; c < neighborColorCounts.length; c++) {
          if (neighborColorCounts[c] > bestCount) {
            bestCount = neighborColorCounts[c]
            bestColor = c
          }
        }
        nextColor[idx] = bestColor
      }
    }
  }

  return { alive: nextAlive, color: nextColor }
}

function livingFraction(alive: Uint8Array): number {
  let count = 0
  for (const v of alive) count += v
  return count / alive.length
}

// Mounted once at the app root (main.tsx), not per-screen - it self-gates on gameView so it's the
// pre-game backdrop (landing, account setup, lobby) and disappears the moment a match starts, where
// the map itself is the game's visual centerpiece instead.
export function AmbientLifeBackground() {
  const inGame = useGameStore((s) => s.gameView !== null)
  const reducedMotion = usePrefersReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (inGame) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    canvas.width = COLS
    canvas.height = ROWS
    let grid = seedGrid()

    function draw() {
      ctx!.clearRect(0, 0, COLS, ROWS)
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const idx = y * COLS + x
          if (grid.alive[idx]) {
            ctx!.fillStyle = PALETTE[grid.color[idx]]
            ctx!.fillRect(x, y, 1, 1)
          }
        }
      }
    }

    draw()
    if (reducedMotion) return

    let raf = 0
    let lastStep = performance.now()
    function tick(now: number) {
      raf = requestAnimationFrame(tick)
      if (now - lastStep < STEP_MS) return
      lastStep = now
      grid = step(grid)
      if (livingFraction(grid.alive) < RESEED_BELOW_FRACTION) grid = seedGrid()
      draw()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inGame, reducedMotion])

  if (inGame) return null

  return (
    <div className="ambient-life-backdrop" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
