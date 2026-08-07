// Mirrors the canonical category taxonomy in Triviador.Infrastructure/Content/QuestionRepository.cs
// (ChoiceCategories/TipCategories). Purely a display affordance for the category-ban picker so a
// category reads at a glance - the server is the source of truth for which category ids exist; an
// id with no explicit mapping here still renders fine via the fallback.
const CATEGORY_EMOJI: Record<string, string> = {
  geography: '🌍',
  history: '🏛️',
  science: '🔬',
  nature: '🌿',
  sports: '⚽',
  'pop-culture': '🎬',
  technology: '💻',
  'arts-literature': '🎭',
  'mythology-religion': '⚡',
  'space-astronomy': '🚀',
  'food-drink': '🍽️',
  'economy-business': '💰',
  'language-wordplay': '📝',
}

const FALLBACK_EMOJI = '❓'

export function categoryEmoji(categoryId: string): string {
  return CATEGORY_EMOJI[categoryId] ?? FALLBACK_EMOJI
}
