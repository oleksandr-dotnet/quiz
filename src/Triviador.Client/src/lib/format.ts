import i18next from '../i18n'
import type { GameView, PlayerView } from '../api/contracts'

export function secondsRemaining(ms: number): number {
  return Math.ceil(ms / 1000)
}

export function playerLabel(player: PlayerView | undefined | null): string {
  if (!player) return i18next.t('common.aPlayer')
  return player.displayName ?? i18next.t(player.isBot ? 'common.aBot' : 'common.aPlayer')
}

export function playerDisplayName(player: PlayerView | undefined | null): string {
  if (!player) return i18next.t('common.player')
  return player.displayName ?? i18next.t(player.isBot ? 'common.bot' : 'common.player')
}

export function findPlayer(view: GameView, playerId: string | null | undefined): PlayerView | undefined {
  if (!playerId) return undefined
  return view.players.find((p) => p.playerId === playerId)
}

const LAURELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

export function laurelNumeral(rank: number): string {
  return LAURELS[rank - 1] ?? String(rank)
}
