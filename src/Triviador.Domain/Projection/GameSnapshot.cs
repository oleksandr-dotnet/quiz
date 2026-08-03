using System.Collections.Immutable;
using System.Text;
using Triviador.Domain.Primitives;
using Triviador.Domain.State;

namespace Triviador.Domain.Projection;

public sealed record PlayerSnapshot(PlayerId Id, int Seat, RegionId? BaseRegion, bool Eliminated, bool Withdrawn);

public sealed record RegionSnapshot(RegionId Id, PlayerId? OwnerId, bool IsBase);

// An immutable copy of GameState at one instant — the internal primitive replay/hygiene checks
// compare against. Not a wire DTO: Triviador.Application's future StateProjector is what redacts
// this shape (or a richer one) for a specific viewer before anything reaches a browser.
public sealed record GameSnapshot(
    GamePhase Phase,
    ImmutableArray<PlayerSnapshot> Players,
    ImmutableArray<RegionSnapshot> Regions,
    string? PendingKind,
    ActivityToken NextActivityToken)
{
    public string Fingerprint()
    {
        var builder = new StringBuilder();
        builder.Append(Phase).Append('|');

        foreach (var player in Players)
        {
            builder.Append(player.Id).Append(':').Append(player.Seat).Append(':')
                .Append(player.BaseRegion).Append(':').Append(player.Eliminated).Append(':')
                .Append(player.Withdrawn).Append(';');
        }

        foreach (var region in Regions)
        {
            builder.Append(region.Id).Append(':').Append(region.OwnerId).Append(':').Append(region.IsBase).Append(';');
        }

        builder.Append(PendingKind).Append('|').Append(NextActivityToken);
        return builder.ToString();
    }
}
