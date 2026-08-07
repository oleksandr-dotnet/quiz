import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { setSeat, setGameSettings, leaveRoom, startGame, kickPlayer } from '../api/commands'
import { useGameStore } from '../store/gameStore'
import { Toast } from '../components/Toast'
import { KickConfirmModal } from '../components/KickConfirmModal'
import { HeraldicDefs } from '../components/map/HeraldicDefs'
import { avatarGlyph } from '../lib/avatars'
import { SEAT_COLORS, hatchPatternIdFor } from '../lib/seats'
import type { GameSettingsView, SeatDto } from '../api/contracts'

const MIN_SEATS_TO_START = 2

type GameSettingKey = keyof GameSettingsView

export function LobbyScreen() {
  const { t } = useTranslation()
  const view = useGameStore((s) => s.view)
  const leaveGame = useGameStore((s) => s.leaveGame)
  const [startError, setStartError] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [kickTarget, setKickTarget] = useState<SeatDto | null>(null)

  if (!view) return null

  const occupiedCount = view.seats.filter((s) => s.isBot || s.displayName !== null).length
  const canStart = view.youAreHost && occupiedCount >= MIN_SEATS_TO_START
  const deepLink = `${window.location.origin}${window.location.pathname}#/room/${view.roomCode}`

  async function toggleSetting(key: GameSettingKey) {
    if (!view!.youAreHost) return
    const settings = view!.gameSettings
    const next = { ...settings, [key]: !settings[key] }
    try {
      await setGameSettings(next.enableAnswerStreaks, next.enableCategoryBanDraft, next.enableGoldenQuestion)
    } catch {
      // Rejection surfaces as a HubException the server logs; the checkbox simply won't change,
      // same tolerance level as toggleSeat below.
    }
  }

  async function toggleSeat(seatIndex: number, currentlyBot: boolean) {
    try {
      await setSeat(seatIndex, !currentlyBot)
    } catch {
      // Rejections (e.g. not host, seat occupied) surface as a HubException the server logs; the
      // seat list simply won't change, which is feedback enough at this scope.
    }
  }

  async function onLeave() {
    try {
      await leaveRoom()
    } finally {
      // leaveGame(), not a bare setSession(null) - it also clears view/gameView, without which a
      // stale snapshot lingers in the store (see the store's own comment on why).
      leaveGame()
    }
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
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      setStartError(t('common.copyFailed'))
    }
  }

  const roomCode = view.roomCode

  async function onCopyCode() {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCodeCopied(true)
      window.setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      setStartError(t('common.copyFailed'))
    }
  }

  return (
    <main className="lobby paper-card">
      <div className="lamplight" aria-hidden="true" />
      <h1>
        {t('lobby.titleLabel')}{' '}
        <button
          type="button"
          className={codeCopied ? 'room-code-value copied' : 'room-code-value'}
          onClick={() => void onCopyCode()}
          title={t('lobby.copyCodeHint')}
          aria-label={t('lobby.copyCodeAriaLabel', { code: view.roomCode })}
          data-testid="room-code"
        >
          {view.roomCode}
        </button>
        <AnimatePresence>
          {codeCopied && (
            <motion.span
              key="code-copied"
              className="copy-feedback"
              role="status"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {t('common.copied')}
            </motion.span>
          )}
        </AnimatePresence>
      </h1>
      <div className="room-share">
        <button onClick={onCopyLink} data-testid="copy-link">
          {linkCopied ? t('common.copied') : t('lobby.copyInviteLink')}
        </button>
      </div>
      <section className="game-settings-panel" data-testid="game-settings-panel">
        <h2 className="game-settings-title">{t('lobby.gameSettingsTitle')}</h2>
        <label className="game-settings-toggle">
          <input
            type="checkbox"
            checked={view.gameSettings.enableAnswerStreaks}
            disabled={!view.youAreHost}
            onChange={() => void toggleSetting('enableAnswerStreaks')}
            data-testid="setting-answer-streaks"
          />
          <span>
            <strong>{t('lobby.settingAnswerStreaksTitle')}</strong>
            <small>{t('lobby.settingAnswerStreaksDescription')}</small>
          </span>
        </label>
        <label className="game-settings-toggle">
          <input
            type="checkbox"
            checked={view.gameSettings.enableCategoryBanDraft}
            disabled={!view.youAreHost}
            onChange={() => void toggleSetting('enableCategoryBanDraft')}
            data-testid="setting-category-ban-draft"
          />
          <span>
            <strong>{t('lobby.settingCategoryBanTitle')}</strong>
            <small>{t('lobby.settingCategoryBanDescription')}</small>
          </span>
        </label>
        <label className="game-settings-toggle">
          <input
            type="checkbox"
            checked={view.gameSettings.enableGoldenQuestion}
            disabled={!view.youAreHost}
            onChange={() => void toggleSetting('enableGoldenQuestion')}
            data-testid="setting-golden-question"
          />
          <span>
            <strong>{t('lobby.settingGoldenQuestionTitle')}</strong>
            <small>{t('lobby.settingGoldenQuestionDescription')}</small>
          </span>
        </label>
      </section>
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
