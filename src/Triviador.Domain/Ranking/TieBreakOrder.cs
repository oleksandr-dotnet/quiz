using System.Collections.Immutable;
using Triviador.Domain.Abstractions;
using Triviador.Domain.Primitives;

namespace Triviador.Domain.Ranking;

public sealed record TieBreakOrder(ImmutableArray<PlayerId> Order)
{
    public int IndexOf(PlayerId player) => Order.IndexOf(player);

    public static TieBreakOrder Shuffled(ImmutableArray<PlayerId> participants, IRandomSource random) =>
        new(random.Shuffle(participants));

    public static TieBreakOrder Prefer(PlayerId defender, PlayerId attacker) =>
        new(ImmutableArray.Create(defender, attacker));
}
