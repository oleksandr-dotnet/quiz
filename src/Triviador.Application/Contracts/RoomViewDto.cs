using Triviador.Domain.State;

namespace Triviador.Application.Contracts;

public sealed record RoomViewDto(
    string RoomCode,
    Guid YouPlayerId,
    bool YouAreHost,
    IReadOnlyList<SeatDto> Seats,
    Language Language);

public sealed record SeatDto(
    int SeatIndex,
    Guid? PlayerId,
    string? DisplayName,
    bool IsBot,
    bool IsConnected,
    bool IsHost);
