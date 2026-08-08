import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import type { GameView, PlayerView } from '../api/contracts'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { Avatar } from './Avatar'
import { emoteGlyph } from '../lib/emotes'
import { BASE_HIT_POINTS_DEFAULT } from '../lib/gameRules'
import { playerDisplayName } from '../lib/format'
import { SEAT_COLORS, hatchPatternIdFor } from '../lib/seats'
import { useGameStore } from '../store/gameStore'
import { Odometer } from './Odometer'
import { PlayerActionMenu } from './PlayerActionMenu'

export interface PlayerRosterProps {
  view: GameView
  activePlayerId?: string | null
  sort?: 'seat' | 'score'
  showWinners?: ReadonlySet<string>
  youAreHost?: boolean
  viewerPlayerId?: string | null
  onKick?: (player: PlayerView) => void
}

// Replaces the separate ScoreBoard/BaseHealthBoard fragments (previously used in JSX with no CSS
// rules at all for .battle/.base-health/.reveal-timer): one seat card carries hatch swatch, name,
// rolling score, HP pips, eliminated/disconnected states, and the active-turn highlight.
export function PlayerRoster({
  view,
  activePlayerId,
  sort = 'seat',
  showWinners,
  youAreHost = false,
  viewerPlayerId = null,
  onKick,
}: PlayerRosterProps) {
  const players =
    sort === 'score' ? [...view.players].sort((a, b) => b.score - a.score) : [...view.players].sort((a, b) => a.seat - b.seat)
  const reducedMotion = usePrefersReducedMotion()
  const [menuOpenForSeat, setMenuOpenForSeat] = useState<number | null>(null)

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
            canKick={youAreHost && onKick !== undefined && p.playerId !== viewerPlayerId && !p.withdrawn}
            menuOpen={menuOpenForSeat === p.seat}
            onToggleMenu={() => setMenuOpenForSeat((current) => (current === p.seat ? null : p.seat))}
            onCloseMenu={() => setMenuOpenForSeat(null)}
            onKick={() => {
              setMenuOpenForSeat(null)
              onKick?.(p)
            }}
          />
        ))}
      </AnimatePresence>
    </ul>
  )
}

// Tiering per the confirmed spec: 0 = no badge, 1-3 bronze, 4-5 silver, 6 gold (static),
// 7+ gold with an animated rainbow layer on top. The rainbow layer is opt-out via `reducedMotion`
// (falls back to the plain static gold badge) rather than gated in CSS alone, matching how every
// other `motion`-driven flourish in this file is disabled via usePrefersReducedMotion().
function streakTierClass(streak: number, reducedMotion: boolean): string {
  const classes = ['streak-badge']
  if (streak >= 6) {
    classes.push('streak-gold')
    if (streak >= 7 && !reducedMotion) classes.push('streak-rainbow')
  } else if (streak >= 4) {
    classes.push('streak-silver')
  } else {
    classes.push('streak-bronze')
  }
  return classes.join(' ')
}

function PlayerCard({
  player,
  isActive,
  isWinner,
  reducedMotion,
  canKick,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onKick,
}: {
  player: PlayerView
  isActive: boolean
  isWinner: boolean
  reducedMotion: boolean
  canKick: boolean
  menuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
  onKick: () => void
}) {
  const { t } = useTranslation()
  const emote = useGameStore((s) => s.emotesByPlayer[player.playerId])
  const seatColor = SEAT_COLORS[player.seat % SEAT_COLORS.length]
  const classes = ['player-card']
  if (isActive) classes.push('active-turn')
  if (player.eliminated) classes.push('eliminated')
  if (player.withdrawn) classes.push('withdrawn')
  if (!player.isConnected) classes.push('disconnected')
  if (isWinner) classes.push('winner')
  if (canKick) classes.push('kickable')

  return (
    <motion.li
      className={classes.join(' ')}
      data-testid={`player-card-${player.seat}`}
      layout={!reducedMotion}
      initial={reducedMotion ? false : { opacity: 0, y: -6, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, height: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.22, 0.61, 0.36, 1] }}
      onClick={canKick ? onToggleMenu : undefined}
      role={canKick ? 'button' : undefined}
      tabIndex={canKick ? 0 : undefined}
      onKeyDown={
        canKick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggleMenu()
              }
            }
          : undefined
      }
      style={{
        position: 'relative',
        cursor: canKick ? 'pointer' : undefined,
        // The action menu overlaps the next sibling card (absolutely positioned, top: 100%) - without
        // an explicit z-index here, that sibling's own `position: relative` (with no z-index of its
        // own) still paints after this one in normal stacking order and intercepts clicks meant for
        // the menu. Only elevated while the menu is actually open, so it never affects normal layout.
        zIndex: menuOpen ? 30 : undefined,
      }}
    >
      {emote && <EmoteBubble emoteId={emote.emoteId} nonce={emote.nonce} />}
      <svg className="seat-swatch" width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
        <rect width={18} height={18} rx={3} fill={seatColor} fillOpacity={0.35} />
        <rect width={18} height={18} rx={3} fill={`url(#${hatchPatternIdFor(player.seat)})`} fillOpacity={0.4} />
        <rect width={18} height={18} rx={3} fill="none" stroke={seatColor} strokeWidth={1.5} />
      </svg>
      <span className="player-name">
        <Avatar avatarId={player.avatarId} />
        {playerDisplayName(player)}
        {!player.isConnected && (
          <span className="disconnected-glyph" title={t('common.disconnected')} aria-label={t('common.disconnected')}>
            {' '}
            ⛓︎‍💥
          </span>
        )}
      </span>
      {player.answerStreak > 0 && !player.eliminated && !player.withdrawn && (
        <span
          className={streakTierClass(player.answerStreak, reducedMotion)}
          aria-label={t('playerRoster.streakAriaLabel', { streak: player.answerStreak })}
        >
          {player.answerStreak}
        </span>
      )}
      {player.baseHitPoints !== null && !player.eliminated && (
        <span className="hit-points" aria-label={t('playerRoster.hitPointsAriaLabel', { hp: player.baseHitPoints })}>
          {Array.from({ length: BASE_HIT_POINTS_DEFAULT }, (_, i) => (
            <span key={i} className={i < player.baseHitPoints! ? 'hp-pip filled' : 'hp-pip'} />
          ))}
        </span>
      )}
      <Odometer value={player.score} />
      {player.eliminated && <span className="fallen-banner">{t('playerRoster.fallen')}</span>}
      {player.withdrawn && !player.eliminated && <span className="fallen-banner">{t('playerRoster.kicked')}</span>}
      {isWinner && <span className="winner-banner">{t('playerRoster.winner')}</span>}
      {menuOpen && (
        <PlayerActionMenu
          onKick={(e) => {
            e.stopPropagation()
            onKick()
          }}
          onClose={onCloseMenu}
        />
      )}
    </motion.li>
  )
}

// Owns its own visibility timer (keyed by `nonce`, not just `emoteId` - a repeat of the same emote
// must still restart the animation) so PlayerRoster doesn't need to schedule per-player cleanup
// itself; gameStore.emotesByPlayer simply keeps holding the last-received value forever.
const EMOTE_BUBBLE_DURATION_MS = 2200

function EmoteBubble({ emoteId, nonce }: { emoteId: string; nonce: number }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setVisible(true)
    const id = window.setTimeout(() => setVisible(false), EMOTE_BUBBLE_DURATION_MS)
    return () => window.clearTimeout(id)
  }, [nonce])

  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          key={nonce}
          className="emote-bubble"
          aria-hidden="true"
          initial={{ opacity: 0, y: 6, scale: 0.7 }}
          animate={{ opacity: 1, y: -2, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.85 }}
          transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {emoteGlyph(emoteId)}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
