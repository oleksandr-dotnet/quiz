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
