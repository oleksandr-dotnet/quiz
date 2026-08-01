using Triviador.Domain.Primitives;

namespace Triviador.Domain.State;

public sealed class PlayerState
{
    public required PlayerId Id { get; init; }

    public required int Seat { get; init; }

    public RegionId? BaseRegion { get; internal set; }

    public bool Eliminated { get; internal set; }

    // Persistent and global: never regenerates, and stays wherever a previous assault left it even
    // across a different attacker's later turn. Lives here rather than on RegionState because a
    // captured base stops needing hit points at all — see GameState.IsBase's ownership-derived model.
    public int BaseHitPoints { get; internal set; }
}
