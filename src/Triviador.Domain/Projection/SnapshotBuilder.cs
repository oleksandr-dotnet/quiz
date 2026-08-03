using System.Collections.Immutable;
using Triviador.Domain.State;

namespace Triviador.Domain.Projection;

public static class SnapshotBuilder
{
    public static GameSnapshot Build(GameState state)
    {
        var players = state.Players
            .Select(p => new PlayerSnapshot(p.Id, p.Seat, p.BaseRegion, p.Eliminated, p.Withdrawn))
            .ToImmutableArray();

        var regions = state.Regions
            .Select(r => new RegionSnapshot(r.Id, r.OwnerId, state.IsBase(r.Id)))
            .ToImmutableArray();

        return new GameSnapshot(state.Phase, players, regions, state.Pending?.GetType().Name, state.NextActivityToken);
    }
}
