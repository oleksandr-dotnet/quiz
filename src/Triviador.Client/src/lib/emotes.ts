// Keep ids in sync with the server's allow-list (RoomActor.ValidEmoteIds) - a closed set rather
// than free text, so a room never has to render/sanitize arbitrary strings another player sends.
export interface EmoteDef {
  id: string
  glyph: string
  labelKey: string
  // Renders glyph as bold letters (a "GG"/"LOL" sticker) instead of an emoji pictograph.
  text?: boolean
}

export const EMOTES: EmoteDef[] = [
  { id: 'gg', glyph: '🤝', labelKey: 'emotes.gg' },
  { id: 'ggtext', glyph: 'GG', labelKey: 'emotes.ggtext', text: true },
  { id: 'lol', glyph: '😂', labelKey: 'emotes.lol' },
  { id: 'wow', glyph: '😮', labelKey: 'emotes.wow' },
  { id: 'monkey', glyph: '🐵', labelKey: 'emotes.monkey' },
  { id: 'cry', glyph: '😭', labelKey: 'emotes.cry' },
  { id: 'angry', glyph: '😡', labelKey: 'emotes.angry' },
  { id: 'cringe', glyph: '😬', labelKey: 'emotes.cringe' },
  { id: 'clown', glyph: '🤡', labelKey: 'emotes.clown' },
  { id: 'horror', glyph: '😱', labelKey: 'emotes.horror' },
  { id: 'loltext', glyph: 'LOL', labelKey: 'emotes.loltext', text: true },
]

const BY_ID = new Map(EMOTES.map((e) => [e.id, e]))

export function emoteGlyph(emoteId: string): string {
  return BY_ID.get(emoteId)?.glyph ?? '❔'
}
