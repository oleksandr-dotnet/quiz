using System.Collections.Immutable;
using Triviador.Domain.Primitives;
using Triviador.Domain.Questions;

namespace Triviador.Domain.Abstractions;

public interface IQuestionSource
{
    Question Draw(QuestionDraw draw);

    // The canonical category set this content exposes, in a fixed order - read by the engine to run
    // category-ban-draft rather than duplicating a literal list in Domain.
    ImmutableArray<CategoryId> AvailableCategories();
}
