import { avatarGlyph } from '../lib/avatars'

export interface AvatarProps {
  avatarId: string | null | undefined
  className?: string
}

// The one render seam for avatar art across the whole client - every avatar render site (roster,
// recap screens, landing) goes through this instead of calling avatarGlyph directly, so switching
// the avatar set from bundled emoji to uploaded photos later is a change to this one component, not
// a hunt through every call site (see add-shareable-game-recap's design.md Decision 5).
export function Avatar({ avatarId, className }: AvatarProps) {
  const glyph = avatarGlyph(avatarId)
  if (!glyph) return null
  return (
    <span className={className ? `player-avatar ${className}` : 'player-avatar'} aria-hidden="true">
      {glyph}
    </span>
  )
}
