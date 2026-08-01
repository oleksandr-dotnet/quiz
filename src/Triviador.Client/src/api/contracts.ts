export interface SeatDto {
  seatIndex: number
  playerId: string | null
  displayName: string | null
  isBot: boolean
  isConnected: boolean
  isHost: boolean
}

export type Language = 'Russian' | 'English'

export interface RoomView {
  roomCode: string
  youPlayerId: string
  youAreHost: boolean
  seats: SeatDto[]
  language: Language
}

export interface JoinResult {
  success: boolean
  rejectionReason: string | null
  roomCode: string | null
  playerId: string | null
  playerToken: string | null
  view: RoomView | null
}

export type GamePhase = 'Lobby' | 'BaseSelection' | 'LandGrab' | 'Battle' | 'Finished'

export interface RegionView {
  regionId: string
  name: string
  value: number
  centerX: number
  centerY: number
  radius: number
  labelX: number
  labelY: number
  adjacentTo: string[]
  ownerPlayerId: string | null
  isBase: boolean
}

export interface PlayerView {
  playerId: string
  seat: number
  displayName: string | null
  isBot: boolean
  isConnected: boolean
  baseRegionId: string | null
  score: number
  eliminated: boolean
  baseHitPoints: number | null
}

export type AnswerKind = 'Choice' | 'Numeric' | 'None'

export interface AnswerValueView {
  kind: AnswerKind
  optionIndex: number | null
  numericValue: number | null
}

export type QuestionKind = 'Choice' | 'Tip'

export interface QuestionPromptView {
  questionId: string
  kind: QuestionKind
  text: string
  options: string[]
  unit: string | null
}

export interface PendingQuestionView {
  prompt: QuestionPromptView
  participantPlayerIds: string[]
  hasAnswered: Record<string, boolean>
  yourAnswer: AnswerValueView | null
  deadline: string
}

export interface PendingRegionPickView {
  currentPickerPlayerId: string
  eligibleRegionIds: string[]
  deadline: string
}

export interface RevealedAnswerView {
  playerId: string
  answer: AnswerValueView
  rank: number
  elapsedMs: number | null
}

export interface LastRevealView {
  prompt: QuestionPromptView
  correctAnswer: AnswerValueView
  answers: RevealedAnswerView[]
}

export interface PendingAttackTargetView {
  currentAttackerPlayerId: string
  eligibleTargetRegionIds: string[]
  deadline: string
}

export interface PendingRevealView {
  prompt: QuestionPromptView
  correctAnswer: AnswerValueView
  answers: RevealedAnswerView[]
  deadline: string
}

export interface GameOutcomeView {
  winnerPlayerIds: string[]
}

export interface PendingBasePickView {
  currentPickerPlayerId: string
  eligibleRegionIds: string[]
  deadline: string
}

export type BattleKind = 'Duel' | 'BaseAssault'

export interface BattleContextView {
  kind: BattleKind
  contestedRegionId: string
  attackerPlayerId: string
  defenderPlayerId: string
  assaultQuestionIndex: number | null
  damageDealtThisTurn: number | null
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
  pendingQuestion: PendingQuestionView | null
  pendingRegionPick: PendingRegionPickView | null
  lastReveal: LastRevealView | null
  currentRound: number
  pendingAttackTarget: PendingAttackTargetView | null
  pendingReveal: PendingRevealView | null
  outcome: GameOutcomeView | null
  pendingBasePick: PendingBasePickView | null
  battle: BattleContextView | null
  language: Language
}
