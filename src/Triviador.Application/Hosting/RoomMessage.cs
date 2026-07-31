using Triviador.Application.Contracts;

namespace Triviador.Application.Hosting;

public abstract record RoomMessage;

public sealed record JoinRequest(
    string DisplayName,
    string? PlayerToken,
    string ConnectionId,
    TaskCompletionSource<JoinResult> Reply) : RoomMessage;

public sealed record SetSeatRequest(
    Guid RequestingPlayerId,
    int SeatIndex,
    bool IsBot,
    TaskCompletionSource<CommandAck> Reply) : RoomMessage;

public sealed record LeaveRequest(
    Guid PlayerId,
    TaskCompletionSource<CommandAck> Reply) : RoomMessage;

/// Posted when a connection drops. There is no matching "reconnected" variant -
/// a reconnecting client always rebinds via a fresh JoinRequest carrying its token.
public sealed record ConnectionLost(string ConnectionId) : RoomMessage;

/// Server-side-only view lookup (e.g. CreateRoom re-reading the host's view after
/// seeding bot seats). Not exposed to clients as a hub RPC - a fresh client
/// connection always rebinds via JoinRequest instead; see GameHub's design note.
public sealed record ViewRequest(Guid PlayerId, TaskCompletionSource<RoomViewDto> Reply) : RoomMessage;

public sealed record ShutdownRequest(TaskCompletionSource Done) : RoomMessage;

public sealed record CommandAck(bool Success, string? RejectionReason = null)
{
    public static readonly CommandAck Ok = new(true);

    public static CommandAck Reject(string reason) => new(false, reason);
}

public sealed record JoinResult(
    bool Success,
    string? RejectionReason,
    Guid? PlayerId,
    string? PlayerToken,
    RoomViewDto? View)
{
    public static JoinResult Failure(string reason) => new(false, reason, null, null, null);

    public static JoinResult Ok(Guid playerId, string playerToken, RoomViewDto view) =>
        new(true, null, playerId, playerToken, view);
}
