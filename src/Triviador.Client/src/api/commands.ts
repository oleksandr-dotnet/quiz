import { getConnection } from './connection'
import type { JoinResult, Language } from './contracts'

export const createRoom = (displayName: string, botSeats: number, language: Language): Promise<JoinResult> =>
  getConnection().invoke('CreateRoom', displayName, botSeats, language)

export const joinRoom = (roomCode: string, displayName: string, playerToken: string | null): Promise<JoinResult> =>
  getConnection().invoke('JoinRoom', roomCode, displayName, playerToken)

export const setSeat = (seatIndex: number, isBot: boolean): Promise<void> =>
  getConnection().invoke('SetSeat', seatIndex, isBot)

export const leaveRoom = (): Promise<void> => getConnection().invoke('LeaveRoom')

export const startGame = (): Promise<void> => getConnection().invoke('StartGame')

export const selectBase = (regionId: string): Promise<void> => getConnection().invoke('SelectBase', regionId)

export const submitChoiceAnswer = (optionIndex: number): Promise<void> =>
  getConnection().invoke('SubmitAnswer', optionIndex, null)

export const submitNumericAnswer = (value: number): Promise<void> =>
  getConnection().invoke('SubmitAnswer', null, value)

export const pickRegion = (regionId: string): Promise<void> => getConnection().invoke('PickRegion', regionId)

export const selectAttackTarget = (regionId: string): Promise<void> =>
  getConnection().invoke('SelectAttackTarget', regionId)
