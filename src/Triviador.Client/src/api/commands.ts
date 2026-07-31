import { getConnection } from './connection'
import type { JoinResult } from './contracts'

export const createRoom = (displayName: string, botSeats: number): Promise<JoinResult> =>
  getConnection().invoke('CreateRoom', displayName, botSeats)

export const joinRoom = (roomCode: string, displayName: string, playerToken: string | null): Promise<JoinResult> =>
  getConnection().invoke('JoinRoom', roomCode, displayName, playerToken)

export const setSeat = (seatIndex: number, isBot: boolean): Promise<void> =>
  getConnection().invoke('SetSeat', seatIndex, isBot)

export const leaveRoom = (): Promise<void> => getConnection().invoke('LeaveRoom')

export const startGame = (): Promise<void> => getConnection().invoke('StartGame')

export const selectBase = (regionId: string): Promise<void> => getConnection().invoke('SelectBase', regionId)
