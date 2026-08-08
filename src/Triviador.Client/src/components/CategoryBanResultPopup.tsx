import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { categoryEmoji } from '../lib/categoryEmojis'

export interface CategoryBanResultPopupProps {
  categories: readonly string[]
  onDismiss: () => void
}

const AUTO_DISMISS_MS = 6000

// Announces the category-ban draft's outcome once, right as the game hands off into base selection
// (a live, time-limited activity) - deliberately a floating card, not a full-screen modal overlay,
// so it never blocks a click on the map underneath. Auto-dismisses, and can be dismissed early.
export function CategoryBanResultPopup({ categories, onDismiss }: CategoryBanResultPopupProps) {
  const { t } = useTranslation()
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const id = window.setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(id)
  }, [onDismiss])

  return (
    // Centering lives on this plain (non-motion) wrapper, not on the motion.div below - a
    // motion.div writes its own animated x/y/scale straight to the element's inline `transform`,
    // which silently clobbers a CSS `transform: translateX(-50%)` instead of composing with it
    // (the same failure TurnAnnouncement.tsx's own spotlight-anchor comment documents). Confirmed
    // live: without this split, the popup's left edge sat at exactly 50vw with no offset, pushing
    // most of it off-screen past the right edge on a phone-width viewport - not shifted, over a
    // third of the card clipped off the visible screen entirely.
    <div className="category-ban-result-popup" role="status" aria-live="polite">
      <motion.div
        className="category-ban-result-card paper-card"
        data-testid="category-ban-result-popup"
        initial={reducedMotion ? false : { opacity: 0, y: -16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.97 }}
        transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <button
          type="button"
          className="category-ban-result-close"
          onClick={onDismiss}
          aria-label={t('common.dismiss')}
        >
          ×
        </button>
        <h2 className="category-ban-result-title">{t('categoryBan.resultTitle')}</h2>
        <ul className="category-ban-result-list">
          {categories.map((c) => (
            <li key={c}>
              <span aria-hidden="true">{categoryEmoji(c)}</span>
              {t(`categoryBan.category.${c}`, { defaultValue: c })}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  )
}
