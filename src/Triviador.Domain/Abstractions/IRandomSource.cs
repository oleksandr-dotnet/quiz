using System.Collections.Immutable;

namespace Triviador.Domain.Abstractions;

public interface IRandomSource
{
    int NextInt(int minInclusive, int maxExclusive);

    ImmutableArray<T> Shuffle<T>(ImmutableArray<T> items);
}
