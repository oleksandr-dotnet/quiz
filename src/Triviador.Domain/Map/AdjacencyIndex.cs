using System.Collections.Immutable;
using Triviador.Domain.Primitives;

namespace Triviador.Domain.Map;

public sealed class AdjacencyIndex
{
    private readonly ImmutableDictionary<RegionId, ImmutableHashSet<RegionId>> _neighbors;

    public AdjacencyIndex(MapDescriptor map)
    {
        var builder = ImmutableDictionary.CreateBuilder<RegionId, ImmutableHashSet<RegionId>>();
        foreach (var region in map.Regions)
        {
            builder[region.Id] = region.AdjacentTo.ToImmutableHashSet();
        }

        _neighbors = builder.ToImmutable();
    }

    public IReadOnlyCollection<RegionId> NeighborsOf(RegionId region) => _neighbors[region];

    public int HopDistance(RegionId from, RegionId to)
    {
        if (from == to)
        {
            return 0;
        }

        var visited = new HashSet<RegionId> { from };
        var frontier = new Queue<(RegionId Region, int Distance)>();
        frontier.Enqueue((from, 0));

        while (frontier.Count > 0)
        {
            var (region, distance) = frontier.Dequeue();
            foreach (var neighbor in _neighbors[region])
            {
                if (neighbor == to)
                {
                    return distance + 1;
                }

                if (visited.Add(neighbor))
                {
                    frontier.Enqueue((neighbor, distance + 1));
                }
            }
        }

        return int.MaxValue;
    }

    public bool IsWithinHops(RegionId from, RegionId to, int maxHops) => HopDistance(from, to) <= maxHops;
}
