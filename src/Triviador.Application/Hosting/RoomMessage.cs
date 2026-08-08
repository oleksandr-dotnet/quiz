using Triviador.Application.Accounts;
using Triviador.Application.Contracts;
using Triviador.Domain.Primitives;
using Triviador.Domain.Questions;

namespace Triviador.Application.Hosting;

public abstract record RoomMessage;

public sealed record JoinRequest(
    string DisplayName,
    string? PlayerToken,
    string ConnectionId,
    TaskCompletionSource<JoinResult> Reply,
    AccountProfileDto? Account = null) : RoomMessage;

public sealed record SetSeatRequest(
    Guid RequestingPlayerId,
    int SeatIndex,
    bool IsBot,
    TaskCompletionSource<CommandAck> Reply) : RoomMessage;

public sealed record LeaveRequest(
    Guid PlayerId,
    TaskCompletionSource<CommandAck> Reply) : RoomMessage;

public sealed record KickPlayerRequest(
    Guid RequestingPlayerId,
    Guid TargetPlayerId,
    KickLandPolicy LandPolicy,
    TaskCompletionSource<CommandAck> Reply) : RoomMessage;

/// Posted when a connection drops. There is no matching "reconnected" variant -
/// a reconnecting client always rebinds via a fresh JoinRequest carrying its token.
public sealed record ConnectionLost(string ConnectionId) : RoomMessage;

/// Server-side-only view lookup (e.g. CreateRoom re-reading the host's view after
/// seeding bot seats). Not exposed to clients as a hub RPC - a fresh client
/// connection always rebinds via JoinRequest instead; see GameHub's design note.
public sealed record ViewRequest(Guid PlayerId, TaskCompletionSource<RoomViewDto> Reply) : RoomMessage;

public sealed record ShutdownRequest(TaskCompletionSource Done) : RoomMessage;

/// Host-only, Lobby-only. Never reaches the domain engine directly - identical in spirit to
/// SetSeatRequest: purely RoomActor-level lobby state that GameRules is built from once StartGame
/// runs. See game-setup-rules' "three gameplay mechanics are independently host-configurable".
public sealed record SetGameSettingsRequest(
    Guid RequestingPlayerId,
    bool EnableAnswerStreaks,
    bool EnableCategoryBanDraft,
    bool EnableGoldenQuestion,
    TaskCompletionSource<CommandAck> Reply) : RoomMessage;

public sealed record ProposeCategoryBansRequest(
    Guid RequestingPlayerId, IReadOnlyList<string> CategoryIds, TaskCompletionSource<CommandAck> Reply) : RoomMessage;

public sealed record StartGameRequest(Guid RequestingPlayerId, TaskCompletionSource<CommandAck> Reply) : RoomMessage;

public sealed record SelectBaseRequest(
    Guid RequestingPlayerId, string RegionId, TaskCompletionSource<CommandAck> Reply) : RoomMessage;

public sealed record SubmitAnswerRequest(
    Guid RequestingPlayerId, AnswerValue Answer, TaskCompletionSource<CommandAck> Reply) : RoomMessage;

public sealed record PickRegionRequest(
    Guid RequestingPlayerId, string RegionId, TaskCompletionSource<CommandAck> Reply) : RoomMessage;

public sealed record SelectAttackTargetRequest(
    Guid RequestingPlayerId, string TargetRegionId, TaskCompletionSource<CommandAck> Reply) : RoomMessage;

public sealed record GameViewRequest(Guid PlayerId, TaskCompletionSource<GameViewDto> Reply) : RoomMessage;

/// Sandbox-only (see test-mechanics-playground): immediately expires whatever is currently pending,
/// exactly as if its real deadline had just elapsed - reuses TimeoutElapsed's existing auto-resolve
/// behavior (auto-pick first eligible / resolve a question from whatever's submitted / apply a
/// RevealHold) instead of duplicating it. Rejected outside a sandbox room.
public sealed record ForceExpireRequest(Guid RequestingPlayerId, TaskCompletionSource<CommandAck> Reply) : RoomMessage;

/// Sandbox-only: submits a raw answer computed server-side from the pending question's own correct
/// answer, so a tester can dictate "this participant answers correctly/incorrectly" without knowing
/// (or the client ever seeing) the real answer. Goes through the exact same SubmitAnswer command a
/// real player's answer would, so scoring/ranking/streaks behave identically. Rejected outside a
/// sandbox room.
public sealed record ForceAnswerRequest(
    Guid RequestingPlayerId, Guid TargetPlayerId, bool WantCorrect, TaskCompletionSource<CommandAck> Reply) : RoomMessage;

/// A player-to-room emote/sticker broadcast - purely presentational (never touches engine state),
/// so it's a fire-and-forget lobby-or-mid-game side channel rather than a domain command.
public sealed record EmoteRequest(
    Guid RequestingPlayerId, string EmoteId, TaskCompletionSource<CommandAck> Reply) : RoomMessage;

/// Carries the exact token the timer was armed for, so a timer superseded by a newer pending
/// activity (already resolved before this fires) is a harmless no-op - the engine's own
/// TimeoutElapsed handling checks this token against whatever is currently pending.
public sealed record EngineTimerElapsed(ActivityToken Token) : RoomMessage;

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
