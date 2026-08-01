using Triviador.Domain.Abstractions;
using Triviador.Domain.State;

namespace Triviador.Application.Content;

public interface IQuestionSourceFactory
{
    IQuestionSource Create(int seed, Language language);
}
