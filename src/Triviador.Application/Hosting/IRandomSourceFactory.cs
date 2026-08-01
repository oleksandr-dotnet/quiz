using Triviador.Domain.Abstractions;

namespace Triviador.Application.Hosting;

public interface IRandomSourceFactory
{
    IRandomSource Create(int seed);
}
