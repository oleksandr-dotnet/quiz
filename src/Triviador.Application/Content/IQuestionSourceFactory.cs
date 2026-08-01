using Triviador.Domain.Abstractions;

namespace Triviador.Application.Content;

public interface IQuestionSourceFactory
{
    IQuestionSource Create(int seed);
}
