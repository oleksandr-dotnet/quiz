import { AVATAR_IDS, type AvatarId } from '../api/contracts'

// Zero-infrastructure avatar set (design.md Decision 6) - an emoji glyph per id, bundled with the
// app itself rather than fetched/uploaded. Keep this list's ids in sync with AVATAR_IDS.
const EMOJI: Record<AvatarId, string> = {
  fox: '🦊',
  owl: '🦉',
  wolf: '🐺',
  bear: '🐻',
  lion: '🦁',
  eagle: '🦅',
  otter: '🦦',
  raven: '🐦‍⬛',
  hawk: '🦅',
  stag: '🦌',
  boar: '🐗',
  lynx: '🐈',
}

export { AVATAR_IDS }

export function avatarGlyph(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null
  return (EMOJI as Record<string, string>)[avatarId] ?? null
}
