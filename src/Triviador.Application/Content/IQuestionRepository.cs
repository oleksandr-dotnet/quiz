using System.Collections.Immutable;
using Triviador.Domain.Questions;

namespace Triviador.Application.Content;

public interface IQuestionRepository
{
    ImmutableArray<Question> AllQuestions();
}
