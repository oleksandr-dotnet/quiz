using Triviador.Domain.State;

namespace Triviador.Application.Contracts;

public sealed record RoomViewDto(
    string RoomCode,
    Guid YouPlayerId,
    bool YouAreHost,
    IReadOnlyList<SeatDto> Seats,
    Language Language,
    GameSettingsDto GameSettings);

public sealed record SeatDto(
    int SeatIndex,
    Guid? PlayerId,
    string? DisplayName,
    string? AvatarId,
    bool IsBot,
    bool IsConnected,
    bool IsHost);

/// The three host-toggleable mechanics (see answer-streaks, category-ban-draft, golden-question),
/// all default enabled. Visible to every seated player pre-start; only the host can change them.
public sealed record GameSettingsDto(
    bool EnableAnswerStreaks,
    bool EnableCategoryBanDraft,
    bool EnableGoldenQuestion)
{
    public static readonly GameSettingsDto Default = new(true, true, true);
}
