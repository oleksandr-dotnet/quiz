using System.Collections.Immutable;
using Triviador.Application.Hosting;
using Triviador.Domain.Abstractions;

namespace Triviador.Infrastructure.Hosting;

// System.Random is banned in Triviador.Domain (see BannedSymbols.txt) so every draw stays
// deterministic from the domain's point of view; this is the one place a seeded instance is
// allowed to actually exist, behind IRandomSource.
public sealed class SeededRandomSource(int seed) : IRandomSource
{
    private readonly Random _random = new(seed);

    public int NextInt(int minInclusive, int maxExclusive) => _random.Next(minInclusive, maxExclusive);

    public ImmutableArray<T> Shuffle<T>(ImmutableArray<T> items)
    {
        var array = items.ToArray();
        for (var i = array.Length - 1; i > 0; i--)
        {
            var j = _random.Next(i + 1);
            (array[i], array[j]) = (array[j], array[i]);
        }
        return ImmutableArray.Create(array);
    }
}

public sealed class RandomSourceFactory : IRandomSourceFactory
{
    public IRandomSource Create(int seed) => new SeededRandomSource(seed);
}
