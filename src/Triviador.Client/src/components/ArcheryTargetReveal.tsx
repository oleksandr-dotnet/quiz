import { useState } from 'react'
import { motion } from 'motion/react'
import type { AnswerValueView, GameView, QuestionPromptView, RevealedAnswerView } from '../api/contracts'
import { findPlayer, playerDisplayName } from '../lib/format'
import { colorForPlayer } from '../lib/seats'
import './ArcheryTargetReveal.css'

export interface ArcheryTargetRevealProps {
  prompt: QuestionPromptView
  correctAnswer: AnswerValueView
  answers: readonly RevealedAnswerView[]
  view: GameView
}

// Geometry constants, in SVG viewBox units. Chosen so the ring set + arrow travel + labels all fit
// inside the viewBox with margin to spare - see design.md's "Risks" section for the label-overflow
// trade-off this leaves room for.
const VIEW_SIZE = 340
const CENTER = VIEW_SIZE / 2
const RING_RADII = [96, 72, 48, 24] // outer -> inner
const BULLSEYE_RADIUS = 9
const INNER_ARROW_RADIUS = 16 // closest an arrow can land to the bullseye
const OUTER_ARROW_RADIUS = 96 // furthest an arrow lands - matches the outermost ring
const FLIGHT_START_RADIUS = 150 // arrows enter from just inside the viewBox edge
const LABEL_RADIUS = OUTER_ARROW_RADIUS + 26
const STAGGER_STEP_SECONDS = 0.22

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface ArrowPlacement {
  playerId: string
  rank: number
  name: string
  color: string
  angleDeg: number
  x: number
  y: number
  startX: number
  startY: number
  labelLeftPct: number
  labelTopPct: number
}

// Replaces the old NumberLine for Tip (numeric) question reveals: concentric rings with the
// bullseye at the correct answer, one arrow per numeric answer landing at a radius proportional to
// |answer - correct|. Angle slots are assigned evenly by rank (not by the answer's sign/magnitude -
// a numeric guess has no natural "direction"), purely so arrows never stack on identical radii.
export function ArcheryTargetReveal({ prompt, correctAnswer, answers, view }: ArcheryTargetRevealProps) {
  const [reducedMotion] = useState(prefersReducedMotion)
  const numericAnswers = answers.filter((a) => a.answer.kind === 'Numeric')
  const correct = correctAnswer.numericValue ?? 0

  const distances = numericAnswers.map((a) => Math.abs((a.answer.numericValue ?? 0) - correct))
  const maxDistance = Math.max(...distances, 1e-6)
  const worstRank = Math.max(...numericAnswers.map((a) => a.rank), 1)
  const count = numericAnswers.length

  const placements: ArrowPlacement[] = numericAnswers.map((a, index) => {
    const distance = Math.abs((a.answer.numericValue ?? 0) - correct)
    const radiusFraction = distance / maxDistance
    const radius = INNER_ARROW_RADIUS + radiusFraction * (OUTER_ARROW_RADIUS - INNER_ARROW_RADIUS)
    const angleDeg = -90 + (index * 360) / count
    const angleRad = (angleDeg * Math.PI) / 180
    const cos = Math.cos(angleRad)
    const sin = Math.sin(angleRad)
    const player = findPlayer(view, a.playerId)
    return {
      playerId: a.playerId,
      rank: a.rank,
      name: playerDisplayName(player),
      color: colorForPlayer(view, a.playerId),
      angleDeg,
      x: CENTER + radius * cos,
      y: CENTER + radius * sin,
      startX: CENTER + FLIGHT_START_RADIUS * cos,
      startY: CENTER + FLIGHT_START_RADIUS * sin,
      labelLeftPct: ((CENTER + LABEL_RADIUS * cos) / VIEW_SIZE) * 100,
      labelTopPct: ((CENTER + LABEL_RADIUS * sin) / VIEW_SIZE) * 100,
    }
  })

  const [landed, setLanded] = useState<Set<string>>(
    () => new Set(reducedMotion ? placements.map((p) => p.playerId) : []),
  )

  function markLanded(playerId: string) {
    setLanded((prev) => {
      if (prev.has(playerId)) return prev
      const next = new Set(prev)
      next.add(playerId)
      return next
    })
  }

  return (
    <div className="archery-target-reveal" aria-hidden="true">
      <div className="archery-target-stage">
        <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} className="archery-target-svg" role="presentation">
          {RING_RADII.map((r, i) => (
            <circle key={r} cx={CENTER} cy={CENTER} r={r} className={`archery-ring archery-ring-${i}`} />
          ))}
          <circle cx={CENTER} cy={CENTER} r={BULLSEYE_RADIUS} className="archery-bullseye" />

          {placements.map((p) => {
            const isLanded = reducedMotion || landed.has(p.playerId)
            const delaySeconds = reducedMotion ? 0 : (worstRank - p.rank) * STAGGER_STEP_SECONDS
            return (
              <motion.g
                key={p.playerId}
                initial={reducedMotion ? false : { x: p.startX, y: p.startY, opacity: 0, scale: 0.5 }}
                animate={{ x: p.x, y: p.y, opacity: 1, scale: 1 }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 260, damping: 13, mass: 0.9, delay: delaySeconds }
                }
                onAnimationComplete={() => markLanded(p.playerId)}
              >
                <g
                  transform={`rotate(${p.angleDeg})`}
                  className={isLanded ? 'archery-arrow landed' : 'archery-arrow'}
                  style={{ color: p.color }}
                >
                  <path d="M0,0 L11,-5 L11,5 Z" className="archery-arrowhead" />
                  <line x1={11} y1={0} x2={31} y2={0} className="archery-arrow-shaft" />
                  <line x1={31} y1={0} x2={25} y2={-6} className="archery-arrow-fletch" />
                  <line x1={31} y1={0} x2={25} y2={6} className="archery-arrow-fletch" />
                </g>
              </motion.g>
            )
          })}
        </svg>

        <div className="archery-labels">
          {placements.map((p) => (
            <span
              key={p.playerId}
              className={landed.has(p.playerId) || reducedMotion ? 'archery-label landed' : 'archery-label'}
              style={{ left: `${p.labelLeftPct}%`, top: `${p.labelTopPct}%`, borderColor: p.color, color: p.color }}
            >
              {p.name}
            </span>
          ))}
        </div>
      </div>

      {prompt.unit && <p className="archery-unit-caption">{prompt.unit}</p>}
    </div>
  )
}
