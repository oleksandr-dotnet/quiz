using Triviador.Domain.Primitives;

namespace Triviador.Domain.Questions;

// Category is server/dealer-side only (like CorrectOptionIndex/CorrectNumericValue) - QuestionPrompt
// never carries it, so it never reaches a broadcast. Used purely to filter draws against
// GameState.BannedCategories - see category-ban-draft.
public sealed record Question(QuestionPrompt Prompt, int? CorrectOptionIndex, long? CorrectNumericValue, CategoryId Category)
{
    public QuestionId Id => Prompt.Id;
}
