using System.Collections.Immutable;
using Triviador.Domain.Primitives;

namespace Triviador.Domain.Questions;

public enum QuestionKindRequest
{
    Any,
    Choice,
    Tip,
}

public sealed record QuestionDraw(QuestionKindRequest Kind, ImmutableHashSet<CategoryId> ExcludedCategories);
