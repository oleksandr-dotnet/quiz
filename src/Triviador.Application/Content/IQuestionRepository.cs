using System.Collections.Immutable;
using Triviador.Domain.Questions;
using Triviador.Domain.State;

namespace Triviador.Application.Content;

public interface IQuestionRepository
{
    ImmutableArray<Question> AllQuestions(Language language);
}
