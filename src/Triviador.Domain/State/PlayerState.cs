using Triviador.Domain.Primitives;

namespace Triviador.Domain.State;

public sealed class PlayerState
{
    public required PlayerId Id { get; init; }

    public required int Seat { get; init; }

    public RegionId? BaseRegion { get; internal set; }

    public bool Eliminated { get; internal set; }
}
