using Triviador.Application.Contracts;

namespace Triviador.Web.Realtime.Contracts;

public sealed record JoinResultDto(
    bool Success,
    string? RejectionReason,
    string? RoomCode,
    Guid? PlayerId,
    string? PlayerToken,
    RoomViewDto? View)
{
    public static JoinResultDto Failure(string reason) => new(false, reason, null, null, null, null);

    public static JoinResultDto Ok(string roomCode, Guid playerId, string playerToken, RoomViewDto view) =>
        new(true, null, roomCode, playerId, playerToken, view);
}
