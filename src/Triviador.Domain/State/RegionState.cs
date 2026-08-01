using Triviador.Domain.Primitives;

namespace Triviador.Domain.State;

// IsBase is derived (see GameState.IsBase) rather than stored here — a stored flag would drift the
// first time a base is captured.
public sealed class RegionState
{
    public required RegionId Id { get; init; }

    public PlayerId? OwnerId { get; internal set; }
}
