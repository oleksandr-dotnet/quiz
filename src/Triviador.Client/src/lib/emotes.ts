// Keep ids in sync with the server's allow-list (RoomActor.ValidEmoteIds) - a closed set rather
// than free text, so a room never has to render/sanitize arbitrary strings another player sends.
export interface EmoteDef {
  id: string
  glyph: string
  labelKey: string
}

export const EMOTES: EmoteDef[] = [
  { id: 'gg', glyph: '🤝', labelKey: 'emotes.gg' },
  { id: 'fire', glyph: '🔥', labelKey: 'emotes.fire' },
  { id: 'lol', glyph: '😂', labelKey: 'emotes.lol' },
  { id: 'wow', glyph: '😮', labelKey: 'emotes.wow' },
  { id: 'thinking', glyph: '🤔', labelKey: 'emotes.thinking' },
  { id: 'cry', glyph: '😢', labelKey: 'emotes.cry' },
  { id: 'angry', glyph: '😡', labelKey: 'emotes.angry' },
  { id: 'crown', glyph: '👑', labelKey: 'emotes.crown' },
  { id: 'clown', glyph: '🤡', labelKey: 'emotes.clown' },
]

const BY_ID = new Map(EMOTES.map((e) => [e.id, e]))

export function emoteGlyph(emoteId: string): string {
  return BY_ID.get(emoteId)?.glyph ?? '❔'
}
