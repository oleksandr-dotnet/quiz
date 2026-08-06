import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Reads the same static content the server loads from disk (see
// Triviador.Infrastructure/Content/QuestionRepository.cs) so a test can deterministically submit a
// correct answer without ever touching a live secret channel - the anti-cheat boundary
// (StateProjector/RoomActor.BuildGameView) never sends the correct answer to a client before a
// question resolves, by design. English fields only: the suite always pins the client to English
// (see goToLanding), which LandingScreen forwards as the room's GameRules.Language at CreateRoom
// time, so served prompt text/options are always the English ones.
const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(here, '..', '..', '..', 'src', 'UI', 'Triviador.Web', 'Data', 'questions')

interface ChoiceQuestionJson {
  text: string
  options: string[]
  correctOptionIndex: number
}

interface TipQuestionJson {
  text: string
  correctNumericValue: number
}

function loadJsonFiles<T>(dir: string): T[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as T[])
}

let choiceByText: Map<string, ChoiceQuestionJson> | null = null
let tipByText: Map<string, TipQuestionJson> | null = null

function choiceBank(): Map<string, ChoiceQuestionJson> {
  choiceByText ??= new Map(loadJsonFiles<ChoiceQuestionJson>(path.join(dataDir, 'choice')).map((q) => [q.text, q]))
  return choiceByText
}

function tipBank(): Map<string, TipQuestionJson> {
  tipByText ??= new Map(loadJsonFiles<TipQuestionJson>(path.join(dataDir, 'tip')).map((q) => [q.text, q]))
  return tipByText
}

/**
 * Given a Choice question's prompt text and its currently-shown (possibly shuffled) option texts,
 * returns the index of the correct one - QuestionDealer shuffles option order per draw, so the
 * bank's own correctOptionIndex can't be used directly against what's on screen.
 */
export function correctChoiceIndex(promptText: string, shownOptions: readonly string[]): number {
  const entry = choiceBank().get(promptText)
  if (!entry) {
    throw new Error(`Unknown choice question text: "${promptText}" - is the room's language English?`)
  }
  const correctText = entry.options[entry.correctOptionIndex]
  const index = shownOptions.indexOf(correctText)
  if (index < 0) {
    throw new Error(`Correct option "${correctText}" not found among shown options for "${promptText}"`)
  }
  return index
}

export function correctNumericValue(promptText: string): number {
  const entry = tipBank().get(promptText)
  if (!entry) {
    throw new Error(`Unknown tip question text: "${promptText}" - is the room's language English?`)
  }
  return entry.correctNumericValue
}
