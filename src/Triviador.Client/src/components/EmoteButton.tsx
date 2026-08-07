import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { sendEmote } from '../api/commands'
import { EMOTES } from '../lib/emotes'

// A lightweight chat-substitute: no free text (see RoomActor.ValidEmoteIds), just a fixed 3x3 grid
// of glyphs any seated player can fire at the room. Self-contained toggle+popover, same
// click-outside/Escape pattern as AppMenu - deliberately mounted twice (desktop top bar + mobile
// top bar), each instance owning its own open state, rather than threading shared state through
// App.tsx for what's a purely local UI concern.
export function EmoteButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocumentClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocumentClick)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function onPick(emoteId: string) {
    if (sending) return
    setSending(true)
    setOpen(false)
    try {
      await sendEmote(emoteId)
    } catch {
      // A rejected emote (e.g. not seated) has no visible consequence worth surfacing - it's a
      // decoration, not a game action.
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="emote-button-wrap" ref={ref}>
      <button
        type="button"
        className="emote-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('emotes.openButton')}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="emote-toggle"
      >
        💬
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="emote-picker paper-card"
            role="menu"
            data-testid="emote-picker"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {EMOTES.map((emote) => (
              <button
                key={emote.id}
                type="button"
                role="menuitem"
                className="emote-option"
                title={t(emote.labelKey)}
                aria-label={t(emote.labelKey)}
                onClick={() => void onPick(emote.id)}
                data-testid={`emote-option-${emote.id}`}
              >
                {emote.glyph}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
