using Triviador.Domain.Primitives;
using Triviador.Domain.State;

namespace Triviador.Application.Contracts;

/// The viewer-aware projection `domain-kernel` deferred to this change: built from `GameState` for a
/// specific viewer. Nothing is redacted today - Lobby/BaseSelection have no hidden hands or answers -
/// but this is where that redaction goes once a phase that has secrets exists.
public sealed record GameViewDto(
    GamePhase Phase,
    string MapViewBox,
    IReadOnlyList<RegionViewDto> Regions,
    IReadOnlyList<PlayerViewDto> Players,
    Guid? CurrentPickerPlayerId,
    DateTimeOffset? DeadlineUtc,
    Guid YouPlayerId,
    bool YouAreCurrentPicker,
    bool BaseSelectionComplete);

public sealed record RegionViewDto(string RegionId, int Value, string RenderPath, Guid? OwnerPlayerId, bool IsBase);

public sealed record PlayerViewDto(Guid PlayerId, int Seat, string? DisplayName, bool IsBot, string? BaseRegionId);
