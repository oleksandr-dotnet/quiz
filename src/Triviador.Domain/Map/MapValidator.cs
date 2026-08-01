using System.Collections.Immutable;
using Triviador.Domain.Primitives;

namespace Triviador.Domain.Map;

public sealed record MapValidationResult(ImmutableArray<string> Errors)
{
    public bool IsValid => Errors.IsEmpty;
}

public static class MapValidator
{
    private static readonly int[] AllowedValues = [200, 400];

    public static MapValidationResult Validate(MapDescriptor map)
    {
        var errors = ImmutableArray.CreateBuilder<string>();
        var seenIds = new HashSet<RegionId>();

        foreach (var region in map.Regions)
        {
            if (!seenIds.Add(region.Id))
            {
                errors.Add($"Duplicate region id '{region.Id}'.");
            }

            if (!AllowedValues.Contains(region.Value))
            {
                errors.Add($"Region '{region.Id}' has value {region.Value}, must be 200 or 400.");
            }
        }

        var byId = map.Regions
            .GroupBy(r => r.Id)
            .ToDictionary(g => g.Key, g => g.First());

        foreach (var region in map.Regions)
        {
            foreach (var neighborId in region.AdjacentTo)
            {
                if (!byId.TryGetValue(neighborId, out var neighbor))
                {
                    errors.Add($"Region '{region.Id}' lists unknown neighbor '{neighborId}'.");
                    continue;
                }

                if (!neighbor.AdjacentTo.Contains(region.Id))
                {
                    errors.Add($"Adjacency is asymmetric between '{region.Id}' and '{neighborId}'.");
                }
            }
        }

        if (errors.Count == 0 && map.Regions.Length > 0)
        {
            var reachable = ReachableFrom(map.Regions[0].Id, byId);
            foreach (var region in map.Regions)
            {
                if (!reachable.Contains(region.Id))
                {
                    errors.Add($"Region '{region.Id}' is not reachable from '{map.Regions[0].Id}' — map is disconnected.");
                }
            }
        }

        return new MapValidationResult(errors.ToImmutable());
    }

    private static HashSet<RegionId> ReachableFrom(RegionId start, Dictionary<RegionId, RegionDescriptor> byId)
    {
        var visited = new HashSet<RegionId> { start };
        var stack = new Stack<RegionId>();
        stack.Push(start);

        while (stack.Count > 0)
        {
            var current = stack.Pop();
            foreach (var neighbor in byId[current].AdjacentTo)
            {
                if (byId.ContainsKey(neighbor) && visited.Add(neighbor))
                {
                    stack.Push(neighbor);
                }
            }
        }

        return visited;
    }
}
