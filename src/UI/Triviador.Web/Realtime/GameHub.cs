using Microsoft.AspNetCore.SignalR;
using Triviador.Application.Contracts;
using Triviador.Application.Hosting;
using Triviador.Domain.Questions;
using Triviador.Domain.State;
using Triviador.Web.Realtime.Contracts;

namespace Triviador.Web.Realtime;

public sealed class GameHub(RoomRegistry registry, ConnectionMap connectionMap) : Hub<IGameClient>
{
    public Task<string> Ping() => Task.FromResult("pong");

    public async Task<JoinResultDto> CreateRoom(string displayName, int botSeats, string? language = null)
    {
        var parsedLanguage = language?.Equals("english", StringComparison.OrdinalIgnoreCase) == true
            ? Language.English
            : Language.Russian;
        var room = registry.CreateRoom(parsedLanguage);
        var hostJoin = await room.JoinAsync(displayName, playerToken: null, Context.ConnectionId);
        if (!hostJoin.Success || hostJoin.PlayerId is null || hostJoin.PlayerToken is null)
        {
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

        return JoinResultDto.Ok(room.RoomCode, hostJoin.PlayerId.Value, hostJoin.PlayerToken, view);
    }

    public async Task<JoinResultDto> JoinRoom(string roomCode, string displayName, string? playerToken)
    {
        if (!registry.TryGet(roomCode, out var room))
        {
            return JoinResultDto.Failure("RoomNotFound");
        }

        var result = await room.JoinAsync(displayName, playerToken, Context.ConnectionId);
        if (!result.Success || result.PlayerId is null || result.PlayerToken is null || result.View is null)
        {
            return JoinResultDto.Failure(result.RejectionReason ?? "Unknown");
        }

        connectionMap.Bind(Context.ConnectionId, room.RoomCode, result.PlayerId.Value);
        return JoinResultDto.Ok(room.RoomCode, result.PlayerId.Value, result.PlayerToken, result.View);
    }

    public async Task SetSeat(int seatIndex, bool isBot)
    {
        var (room, playerId) = ResolveConnection();
        var ack = await room.SetSeatAsync(playerId, seatIndex, isBot);
        if (!ack.Success)
        {
            throw new HubException(ack.RejectionReason);
        }
    }

    public async Task LeaveRoom()
    {
        var (room, playerId) = ResolveConnection();
        await room.LeaveAsync(playerId);
        connectionMap.Remove(Context.ConnectionId);
    }

    public async Task StartGame()
    {
        var (room, playerId) = ResolveConnection();
        var ack = await room.StartGameAsync(playerId);
        if (!ack.Success)
        {
            throw new HubException(ack.RejectionReason);
        }
    }

    public async Task SelectBase(string regionId)
    {
        var (room, playerId) = ResolveConnection();
        var ack = await room.SelectBaseAsync(playerId, regionId);
        if (!ack.Success)
        {
            throw new HubException(ack.RejectionReason);
        }
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
        if (!ack.Success)
        {
            throw new HubException(ack.RejectionReason);
        }
    }

    public async Task PickRegion(string regionId)
    {
        var (room, playerId) = ResolveConnection();
        var ack = await room.PickRegionAsync(playerId, regionId);
        if (!ack.Success)
        {
            throw new HubException(ack.RejectionReason);
        }
    }

    public async Task SelectAttackTarget(string regionId)
    {
        var (room, playerId) = ResolveConnection();
        var ack = await room.SelectAttackTargetAsync(playerId, regionId);
        if (!ack.Success)
        {
            throw new HubException(ack.RejectionReason);
        }
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        if (connectionMap.TryGet(Context.ConnectionId, out var binding) &&
            registry.TryGet(binding.RoomCode, out var room))
        {
            room.NotifyConnectionLost(Context.ConnectionId);
        }
        connectionMap.Remove(Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    private (RoomActor Room, Guid PlayerId) ResolveConnection()
    {
        if (!connectionMap.TryGet(Context.ConnectionId, out var binding))
        {
            throw new HubException("NotInRoom");
        }
        if (!registry.TryGet(binding.RoomCode, out var room))
        {
            throw new HubException("RoomNotFound");
        }
        return (room, binding.PlayerId);
    }
}
