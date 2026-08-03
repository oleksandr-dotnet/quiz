import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence } from 'motion/react'
import { setSeat, leaveRoom, startGame, kickPlayer } from '../api/commands'
import { useGameStore } from '../store/gameStore'
import { Toast } from '../components/Toast'
import { KickConfirmModal } from '../components/KickConfirmModal'
import { HeraldicDefs } from '../components/map/HeraldicDefs'
import { avatarGlyph } from '../lib/avatars'
import { SEAT_COLORS, hatchPatternIdFor } from '../lib/seats'
import type { SeatDto } from '../api/contracts'

const MIN_SEATS_TO_START = 2

export function LobbyScreen() {
  const { t } = useTranslation()
  const view = useGameStore((s) => s.view)
  const setSession = useGameStore((s) => s.setSession)
  const [startError, setStartError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [kickTarget, setKickTarget] = useState<SeatDto | null>(null)

  if (!view) return null

  const occupiedCount = view.seats.filter((s) => s.isBot || s.displayName !== null).length
  const canStart = view.youAreHost && occupiedCount >= MIN_SEATS_TO_START
  const deepLink = `${window.location.origin}${window.location.pathname}#/room/${view.roomCode}`

  async function toggleSeat(seatIndex: number, currentlyBot: boolean) {
    try {
      await setSeat(seatIndex, !currentlyBot)
    } catch {
      // Rejections (e.g. not host, seat occupied) surface as a HubException the server logs; the
      // seat list simply won't change, which is feedback enough at this scope.
    }
  }

  async function onLeave() {
    await leaveRoom()
    setSession(null)
  }

  async function onConfirmKick() {
    if (!kickTarget?.playerId) return
    const targetId = kickTarget.playerId
    setKickTarget(null)
    try {
      await kickPlayer(targetId, 'ReleaseLand')
    } catch {
      setStartError(t('kick.kickFailed'))
    }
  }

  async function onStart() {
    setStartError(null)
    try {
      await startGame()
    } catch (err) {
      setStartError(err instanceof Error ? err.message : t('lobby.startError'))
    }
  }

  async function onCopyLink() {
    try {
      await navigator.clipboard.writeText(deepLink)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setStartError(t('common.copyFailed'))
    }
  }

  return (
    <main className="lobby paper-card">
      <h1>
        {t('lobby.titleLabel')} <span className="room-code-value" data-testid="room-code">{view.roomCode}</span>
      </h1>
      <div className="room-share">
        <button onClick={onCopyLink} data-testid="copy-link">
          {copied ? t('common.copied') : t('lobby.copyInviteLink')}
        </button>
      </div>
      <ul className="seat-list">
        {view.seats.map((seat) => (
          <li key={seat.seatIndex} className={seat.isHost ? 'seat seat-host' : 'seat'} data-testid={`seat-${seat.seatIndex}`}>
            <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
              <rect width={16} height={16} rx={3} fill={SEAT_COLORS[seat.seatIndex % SEAT_COLORS.length]} fillOpacity={0.35} />
              <rect width={16} height={16} rx={3} fill={`url(#${hatchPatternIdFor(seat.seatIndex)})`} fillOpacity={0.4} />
            </svg>
            <span className="seat-name">
              {!seat.isBot && seat.avatarId && (
                <span className="player-avatar" aria-hidden="true">
                  {avatarGlyph(seat.avatarId)}
                </span>
              )}
              {seat.isBot ? t('lobby.seatBot') : seat.displayName ?? t('lobby.seatOpen')}
              {seat.isHost && t('lobby.hostSuffix')}
              {!seat.isBot && seat.displayName && !seat.isConnected && t('lobby.disconnectedSuffix')}
            </span>
            {view.youAreHost && !seat.isConnected && (
              <button onClick={() => toggleSeat(seat.seatIndex, seat.isBot)}>
                {seat.isBot ? t('lobby.openSeat') : t('lobby.fillWithBot')}
              </button>
            )}
            {view.youAreHost && seat.isConnected && !seat.isHost && (
              <button onClick={() => setKickTarget(seat)} data-testid={`kick-seat-${seat.seatIndex}`}>
                {t('playerRoster.kickAction')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {view.youAreHost && (
        <button className="primary" onClick={onStart} disabled={!canStart} data-testid="start-game">
          {t('lobby.startGame')}
          {!canStart && t('lobby.needMoreSeats')}
        </button>
      )}
      <AnimatePresence>{startError && <Toast key="lobby-start-error" message={startError} />}</AnimatePresence>
      <button onClick={onLeave}>{t('lobby.leaveRoom')}</button>

      {/* Hidden SVG carrying the hatch pattern defs referenced by the seat swatches above. */}
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden="true">
        <HeraldicDefs />
      </svg>
      <KickConfirmModal
        open={kickTarget !== null}
        targetName={kickTarget?.displayName ?? t('common.player')}
        requireLandPolicy={false}
        onCancel={() => setKickTarget(null)}
        onConfirm={() => void onConfirmKick()}
      />
    </main>
  )
}
