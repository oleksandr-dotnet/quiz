import { getConnection } from './connection'
import type { JoinResult, KickLandPolicy, Language } from './contracts'

export const createRoom = (displayName: string, botSeats: number, language: Language): Promise<JoinResult> =>
  getConnection().invoke('CreateRoom', displayName, botSeats, language)

// Dev-only room used by the /test-mechanics playground (see components/SandboxControlPanel.tsx) -
// creates, seats, and starts a room in one round trip, flagged server-side so its per-activity
// timers never arm and two extra debug commands (forceExpire/forceAnswer below) become legal.
export const createSandboxRoom = (botCount: number): Promise<JoinResult> =>
  getConnection().invoke('CreateSandboxRoom', botCount)

// Sandbox-only: immediately resolves whatever is currently pending exactly as a real deadline
// would (auto-pick the first eligible option / resolve a question from whatever's submitted /
// apply a reveal), skipping the wait entirely.
export const forceExpire = (): Promise<void> => getConnection().invoke('ForceExpire')

// Sandbox-only: submits a server-computed correct/incorrect raw answer on behalf of any
// participant (yourself or a bot) in the currently pending question, without either side ever
// seeing the real answer.
export const forceAnswer = (targetPlayerId: string, wantCorrect: boolean): Promise<void> =>
  getConnection().invoke('ForceAnswer', targetPlayerId, wantCorrect)

export const joinRoom = (roomCode: string, displayName: string, playerToken: string | null): Promise<JoinResult> =>
  getConnection().invoke('JoinRoom', roomCode, displayName, playerToken)

export const setSeat = (seatIndex: number, isBot: boolean): Promise<void> =>
  getConnection().invoke('SetSeat', seatIndex, isBot)

export const leaveRoom = (): Promise<void> => getConnection().invoke('LeaveRoom')

export const kickPlayer = (targetPlayerId: string, landPolicy: KickLandPolicy): Promise<void> =>
  getConnection().invoke('KickPlayer', targetPlayerId, landPolicy)

export const setGameSettings = (
  enableAnswerStreaks: boolean,
  enableCategoryBanDraft: boolean,
  enableGoldenQuestion: boolean,
): Promise<void> =>
  getConnection().invoke('SetGameSettings', enableAnswerStreaks, enableCategoryBanDraft, enableGoldenQuestion)

export const proposeCategoryBans = (categoryIds: string[]): Promise<void> =>
  getConnection().invoke('ProposeCategoryBans', categoryIds)

export const startGame = (): Promise<void> => getConnection().invoke('StartGame')

export const selectBase = (regionId: string): Promise<void> => getConnection().invoke('SelectBase', regionId)

export const submitChoiceAnswer = (optionIndex: number): Promise<void> =>
  getConnection().invoke('SubmitAnswer', optionIndex, null)

export const submitNumericAnswer = (value: number): Promise<void> =>
  getConnection().invoke('SubmitAnswer', null, value)

export const pickRegion = (regionId: string): Promise<void> => getConnection().invoke('PickRegion', regionId)

export const selectAttackTarget = (regionId: string): Promise<void> =>
  getConnection().invoke('SelectAttackTarget', regionId)

export const sendEmote = (emoteId: string): Promise<void> => getConnection().invoke('SendEmote', emoteId)
