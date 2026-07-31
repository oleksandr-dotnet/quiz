export interface SeatDto {
  seatIndex: number
  playerId: string | null
  displayName: string | null
  isBot: boolean
  isConnected: boolean
  isHost: boolean
}

export interface RoomView {
  roomCode: string
  youPlayerId: string
  youAreHost: boolean
  seats: SeatDto[]
}

export interface JoinResult {
  success: boolean
  rejectionReason: string | null
  roomCode: string | null
  playerId: string | null
  playerToken: string | null
  view: RoomView | null
}

export type GamePhase = 'Lobby' | 'BaseSelection' | 'Finished'

export interface RegionView {
  regionId: string
  value: number
  renderPath: string
  ownerPlayerId: string | null
  isBase: boolean
}

export interface PlayerView {
  playerId: string
  seat: number
  displayName: string | null
  isBot: boolean
  baseRegionId: string | null
}

export interface GameView {
  phase: GamePhase
  mapViewBox: string
  regions: RegionView[]
  players: PlayerView[]
  currentPickerPlayerId: string | null
  deadlineUtc: string | null
  youPlayerId: string
  youAreCurrentPicker: boolean
  baseSelectionComplete: boolean
}
