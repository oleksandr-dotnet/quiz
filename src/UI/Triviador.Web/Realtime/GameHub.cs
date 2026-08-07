using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Triviador.Application.Accounts;
using Triviador.Application.Contracts;
using Triviador.Application.Hosting;
using Triviador.Domain.Questions;
using Triviador.Domain.State;
using Triviador.Web.Realtime.Contracts;

namespace Triviador.Web.Realtime;

public sealed class GameHub(
    RoomRegistry registry,
    ConnectionMap connectionMap,
    IUserAccountRepository accounts,
    ILogger<GameHub> logger) : Hub<IGameClient>
{
    public Task<string> Ping() => Task.FromResult("pong");

    public async Task<JoinResultDto> CreateRoom(string displayName, int botSeats, string? language = null)
    {
        var accountResult = await ResolveAuthenticatedAccountAsync();
        if (accountResult.Rejected)
        {
            return JoinResultDto.Failure(accountResult.RejectionReason!);
        }

        var parsedLanguage = language?.Equals("english", StringComparison.OrdinalIgnoreCase) == true
            ? Language.English
            : Language.Russian;
        var room = registry.CreateRoom(parsedLanguage);
        var hostJoin = await room.JoinAsync(displayName, playerToken: null, Context.ConnectionId, accountResult.Account);
        if (!hostJoin.Success || hostJoin.PlayerId is null || hostJoin.PlayerToken is null)
        {
            logger.LogWarning("Room {RoomCode} creation join failed for {DisplayName}: {Reason}",
                room.RoomCode, displayName, hostJoin.RejectionReason);
            registry.Remove(room.RoomCode);
            return JoinResultDto.Failure(hostJoin.RejectionReason ?? "Unknown");
        }

        connectionMap.Bind(Context.ConnectionId, room.RoomCode, hostJoin.PlayerId.Value);

        var view = hostJoin.View!;
        var clampedBotSeats = Math.Clamp(botSeats, 0, view.Seats.Count - 1);
        for (var seatIndex = 1; seatIndex <= clampedBotSeats; seatIndex++)
        {
            await room.SetSeatAsync(hostJoin.PlayerId.Value, seatIndex, isBot: true);
        }
        if (clampedBotSeats > 0)
        {
            view = await room.GetViewAsync(hostJoin.PlayerId.Value);
        }

        logger.LogInformation(
            "Room {RoomCode} created by {PlayerId} ({DisplayName}) with {BotSeats} bot seats, language {Language}",
            room.RoomCode, hostJoin.PlayerId, displayName, clampedBotSeats, parsedLanguage);

        return JoinResultDto.Ok(room.RoomCode, hostJoin.PlayerId.Value, hostJoin.PlayerToken, view);
    }

    public async Task<JoinResultDto> JoinRoom(string roomCode, string displayName, string? playerToken)
    {
        var accountResult = await ResolveAuthenticatedAccountAsync();
        if (accountResult.Rejected)
        {
            return JoinResultDto.Failure(accountResult.RejectionReason!);
        }

        if (!registry.TryGet(roomCode, out var room))
        {
            logger.LogWarning("Join failed: room {RoomCode} not found (player {DisplayName})", roomCode, displayName);
            return JoinResultDto.Failure("RoomNotFound");
        }

        var result = await room.JoinAsync(displayName, playerToken, Context.ConnectionId, accountResult.Account);
        if (!result.Success || result.PlayerId is null || result.PlayerToken is null || result.View is null)
        {
            logger.LogWarning("Join room {RoomCode} failed for {DisplayName}: {Reason}",
                roomCode, displayName, result.RejectionReason);
            return JoinResultDto.Failure(result.RejectionReason ?? "Unknown");
        }

        connectionMap.Bind(Context.ConnectionId, room.RoomCode, result.PlayerId.Value);
        logger.LogInformation("{PlayerId} ({DisplayName}) joined room {RoomCode}", result.PlayerId, displayName, room.RoomCode);
        return JoinResultDto.Ok(room.RoomCode, result.PlayerId.Value, result.PlayerToken, result.View);
    }

    public async Task SetSeat(int seatIndex, bool isBot)
    {
        var (room, playerId) = ResolveConnection();
        var ack = await room.SetSeatAsync(playerId, seatIndex, isBot);
        EnsureSuccess(ack, nameof(SetSeat));
        logger.LogInformation("Seat {SeatIndex} set to {Kind} in room {RoomCode} by {PlayerId}",
            seatIndex, isBot ? "bot" : "open", room.RoomCode, playerId);
    }

    public async Task LeaveRoom()
    {
        var (room, playerId) = ResolveConnection();
        await room.LeaveAsync(playerId);
        connectionMap.Remove(Context.ConnectionId);
        logger.LogInformation("{PlayerId} left room {RoomCode}", playerId, room.RoomCode);
    }

    public async Task KickPlayer(Guid targetPlayerId, string landPolicy)
    {
        var (room, playerId) = ResolveConnection();
        var parsedPolicy = landPolicy.Equals("BotTakeover", StringComparison.OrdinalIgnoreCase)
            ? KickLandPolicy.BotTakeover
            : KickLandPolicy.ReleaseLand;
        var ack = await room.KickPlayerAsync(playerId, targetPlayerId, parsedPolicy);
        EnsureSuccess(ack, nameof(KickPlayer));
        logger.LogInformation("{PlayerId} kicked {TargetPlayerId} from room {RoomCode} with policy {Policy}",
            playerId, targetPlayerId, room.RoomCode, parsedPolicy);
    }

    public async Task StartGame()
    {
        var (room, playerId) = ResolveConnection();
        var ack = await room.StartGameAsync(playerId);
        EnsureSuccess(ack, nameof(StartGame));
        logger.LogInformation("Game started in room {RoomCode} by {PlayerId}", room.RoomCode, playerId);
    }

    public async Task SelectBase(string regionId)
    {
        var (room, playerId) = ResolveConnection();
        var ack = await room.SelectBaseAsync(playerId, regionId);
        EnsureSuccess(ack, nameof(SelectBase));
    }

    public async Task SubmitAnswer(int? choiceIndex, long? numericValue)
    {
        var (room, playerId) = ResolveConnection();
        AnswerValue answer = choiceIndex is { } idx
            ? new AnswerValue.Choice(idx)
            : numericValue is { } value
                ? new AnswerValue.Numeric(value)
                : AnswerValue.None.Instance;

        var ack = await room.SubmitAnswerAsync(playerId, answer);
        EnsureSuccess(ack, nameof(SubmitAnswer));
    }

    public async Task PickRegion(string regionId)
    {
        var (room, playerId) = ResolveConnection();
        var ack = await room.PickRegionAsync(playerId, regionId);
        EnsureSuccess(ack, nameof(PickRegion));
    }

    public async Task SelectAttackTarget(string regionId)
    {
        var (room, playerId) = ResolveConnection();
        var ack = await room.SelectAttackTargetAsync(playerId, regionId);
        EnsureSuccess(ack, nameof(SelectAttackTarget));
    }

    public async Task SendEmote(string emoteId)
    {
        var (room, playerId) = ResolveConnection();
        var ack = await room.EmoteAsync(playerId, emoteId);
        EnsureSuccess(ack, nameof(SendEmote));
    }

    public override Task OnConnectedAsync()
    {
        logger.LogInformation("Connection {ConnectionId} connected", Context.ConnectionId);
        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        if (connectionMap.TryGet(Context.ConnectionId, out var binding) &&
            registry.TryGet(binding.RoomCode, out var room))
        {
            room.NotifyConnectionLost(Context.ConnectionId);
        }
        connectionMap.Remove(Context.ConnectionId);
        logger.LogInformation("Connection {ConnectionId} disconnected", Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    private void EnsureSuccess(CommandAck ack, string action)
    {
        if (ack.Success)
        {
            return;
        }

        logger.LogWarning("{Action} rejected for connection {ConnectionId}: {Reason}",
            action, Context.ConnectionId, ack.RejectionReason);
        throw new HubException(ack.RejectionReason);
    }

    private readonly record struct AuthenticatedAccountResult(AccountProfileDto? Account, string? RejectionReason)
    {
        public bool Rejected => RejectionReason is not null;

        public static readonly AuthenticatedAccountResult Anonymous = new(null, null);

        public static AuthenticatedAccountResult Reject(string reason) => new(null, reason);

        public static AuthenticatedAccountResult Ok(AccountProfileDto account) => new(account, null);
    }

    /// A connection with no valid access token plays anonymously - completely unaffected, per
    /// player-accounts's "Anonymous play remains fully available". A connection carrying one must
    /// resolve to a fully-set-up account before it's allowed to create or join a room.
    private async Task<AuthenticatedAccountResult> ResolveAuthenticatedAccountAsync()
    {
        var sub = Context.User?.FindFirst("sub")?.Value;
        if (sub is null || !Guid.TryParse(sub, out var userId))
        {
            return AuthenticatedAccountResult.Anonymous;
        }

        var profile = await accounts.FindByIdAsync(userId);
        if (profile is null || !profile.IsSetupComplete)
        {
            return AuthenticatedAccountResult.Reject("AccountSetupRequired");
        }

        return AuthenticatedAccountResult.Ok(profile);
    }

    private (RoomActor Room, Guid PlayerId) ResolveConnection()
    {
        if (!connectionMap.TryGet(Context.ConnectionId, out var binding))
        {
            logger.LogWarning("Connection {ConnectionId} sent a command while not bound to a room", Context.ConnectionId);
            throw new HubException("NotInRoom");
        }
        if (!registry.TryGet(binding.RoomCode, out var room))
        {
            logger.LogWarning("Connection {ConnectionId} referenced unknown room {RoomCode}", Context.ConnectionId, binding.RoomCode);
            throw new HubException("RoomNotFound");
        }
        return (room, binding.PlayerId);
    }
}
