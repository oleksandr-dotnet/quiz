import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { proposeCategoryBans } from '../api/commands'
import { useCountdown } from '../hooks/useCountdown'
import { AnswerRoster } from '../components/AnswerRoster'
import { Timer } from '../components/Timer'
import { categoryEmoji } from '../lib/categoryEmojis'
import { TIMER_TOTALS_MS } from '../lib/timers'
import type { GameView } from '../api/contracts'

const MAX_PICKS = 3

// The pre-game category ban draft: every active player proposes up to 3 categories they'd rather
// not face, then the server randomly bans one per player from their own proposal (see
// category-ban-draft). No map interaction this phase - App.tsx leaves mapProps at its default
// (non-interactive) for GamePhase 'CategoryBan', same as the 'Finished' phase does.
export function CategoryBanDock({ view, onError }: { view: GameView; onError: (message: string) => void }) {
  const { t } = useTranslation()
  const pending = view.pendingCategoryBan
  const remainingMs = useCountdown(pending?.deadline ?? null)
  const [selected, setSelected] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setSelected([])
    setSubmitting(false)
    // A fresh draft only ever happens once per game, but this still resets state defensively if the
    // deadline (and therefore the pending activity) ever changes under us.
  }, [pending?.deadline])

  if (!pending) return null

  const alreadyLocked = pending.yourProposal !== null || submitting
  const participantIds = Object.keys(pending.hasSubmitted)

  function toggle(categoryId: string) {
    if (alreadyLocked) return
    setSelected((prev) =>
      prev.includes(categoryId)
        ? prev.filter((c) => c !== categoryId)
        : prev.length < MAX_PICKS
          ? [...prev, categoryId]
          : prev,
    )
  }

  async function onSubmit() {
    setSubmitting(true)
    try {
      await proposeCategoryBans(selected)
    } catch (err) {
      setSubmitting(false)
      onError(err instanceof Error ? err.message : t('categoryBan.submitRejected'))
    }
  }

  return (
    <section className="paper-card category-ban-card" data-testid="category-ban-card">
      <header className="question-card-header">
        <Timer remainingMs={remainingMs} totalMs={TIMER_TOTALS_MS.categoryBanProposal} />
        <p className="question-text">{t('categoryBan.prompt', { max: MAX_PICKS })}</p>
      </header>

      {alreadyLocked ? (
        <div className="sealed-plate" data-testid="category-ban-sealed">
          {t('categoryBan.sealed')}
        </div>
      ) : (
        <>
          <div className="category-ban-grid">
            {pending.availableCategories.map((categoryId) => {
              const isSelected = selected.includes(categoryId)
              return (
                <button
                  key={categoryId}
                  type="button"
                  className={isSelected ? 'category-chip selected' : 'category-chip'}
                  onClick={() => toggle(categoryId)}
                  data-testid={`category-chip-${categoryId}`}
                >
                  <span className="category-chip-emoji" aria-hidden="true">
                    {categoryEmoji(categoryId)}
                  </span>
                  {t(`categoryBan.category.${categoryId}`, { defaultValue: categoryId })}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="primary category-ban-submit"
            onClick={() => void onSubmit()}
            data-testid="category-ban-submit"
          >
            {selected.length > 0
              ? t('categoryBan.submitWithCount', { count: selected.length })
              : t('categoryBan.submitNone')}
          </button>
        </>
      )}

      <AnswerRoster view={view} participantPlayerIds={participantIds} hasAnswered={pending.hasSubmitted} />
    </section>
  )
}
