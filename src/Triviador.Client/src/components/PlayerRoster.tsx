import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import type { GameView, PlayerView } from '../api/contracts'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { playerDisplayName } from '../lib/format'
import { SEAT_COLORS, hatchPatternIdFor } from '../lib/seats'
import { Odometer } from './Odometer'

export interface PlayerRosterProps {
  view: GameView
  activePlayerId?: string | null
  sort?: 'seat' | 'score'
  showWinners?: ReadonlySet<string>
}

// Replaces the separate ScoreBoard/BaseHealthBoard fragments (previously used in JSX with no CSS
// rules at all for .battle/.base-health/.reveal-timer): one seat card carries hatch swatch, name,
// rolling score, HP pips, eliminated/disconnected states, and the active-turn highlight.
export function PlayerRoster({ view, activePlayerId, sort = 'seat', showWinners }: PlayerRosterProps) {
  const players =
    sort === 'score' ? [...view.players].sort((a, b) => b.score - a.score) : [...view.players].sort((a, b) => a.seat - b.seat)
  const reducedMotion = usePrefersReducedMotion()

  return (
    <ul className="player-roster">
      <AnimatePresence initial={false}>
        {players.map((p) => (
          <PlayerCard
            key={p.playerId}
            player={p}
            isActive={activePlayerId === p.playerId}
            isWinner={showWinners?.has(p.playerId) ?? false}
            reducedMotion={reducedMotion}
          />
        ))}
      </AnimatePresence>
    </ul>
  )
}

function PlayerCard({
  player,
  isActive,
  isWinner,
  reducedMotion,
}: {
  player: PlayerView
  isActive: boolean
  isWinner: boolean
  reducedMotion: boolean
}) {
  const { t } = useTranslation()
  const seatColor = SEAT_COLORS[player.seat % SEAT_COLORS.length]
  const classes = ['player-card']
  if (isActive) classes.push('active-turn')
  if (player.eliminated) classes.push('eliminated')
  if (!player.isConnected) classes.push('disconnected')
  if (isWinner) classes.push('winner')

  return (
    <motion.li
      className={classes.join(' ')}
      data-testid={`player-card-${player.seat}`}
      layout={!reducedMotion}
      initial={reducedMotion ? false : { opacity: 0, y: -6, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, height: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <svg className="seat-swatch" width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
        <rect width={18} height={18} rx={3} fill={seatColor} fillOpacity={0.35} />
        <rect width={18} height={18} rx={3} fill={`url(#${hatchPatternIdFor(player.seat)})`} fillOpacity={0.4} />
        <rect width={18} height={18} rx={3} fill="none" stroke={seatColor} strokeWidth={1.5} />
      </svg>
      <span className="player-name">
        {playerDisplayName(player)}
        {!player.isConnected && (
          <span className="disconnected-glyph" title={t('common.disconnected')} aria-label={t('common.disconnected')}>
            {' '}
            ⛓︎‍💥
          </span>
        )}
      </span>
      {player.baseHitPoints !== null && !player.eliminated && (
        <span className="hit-points" aria-label={t('playerRoster.hitPointsAriaLabel', { hp: player.baseHitPoints })}>
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className={i < player.baseHitPoints! ? 'hp-pip filled' : 'hp-pip'} />
          ))}
        </span>
      )}
      <Odometer value={player.score} />
      {player.eliminated && <span className="fallen-banner">{t('playerRoster.fallen')}</span>}
      {isWinner && <span className="winner-banner">{t('playerRoster.winner')}</span>}
    </motion.li>
  )
}
