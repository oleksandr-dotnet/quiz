using System.Security.Cryptography;
using System.Threading.Channels;
using Microsoft.Extensions.Logging;
using Triviador.Application.Content;
using Triviador.Application.Contracts;
using Triviador.Domain.Commands;
using Triviador.Domain.Engine;
using Triviador.Domain.Primitives;
using Triviador.Domain.State;

namespace Triviador.Application.Hosting;

/// One room = one logical thread: every mutation flows through the single mailbox
/// below, processed by one pump task, so seat state never needs a lock.
public sealed class RoomActor
{
    private readonly Channel<RoomMessage> _mailbox = Channel.CreateUnbounded<RoomMessage>(
        new UnboundedChannelOptions { SingleReader = true, AllowSynchronousContinuations = false });

    private readonly Seat[] _seats;
    private readonly IRoomBroadcaster _broadcaster;
    private readonly IRoomClock _clock;
    private readonly IMapRepository _mapRepository;
    private readonly ILogger<RoomActor>? _logger;
    private readonly Task _pump;

    private Guid? _hostPlayerId;
    private GameEngine? _engine;
    private Timer? _engineTimer;
    private DateTimeOffset _lastActivityUtc;
    private volatile bool _faulted;

    public RoomActor(string roomCode, RoomOptions options, IRoomBroadcaster broadcaster, IRoomClock clock,
        IMapRepository mapRepository, ILogger<RoomActor>? logger = null)
    {
        RoomCode = roomCode;
        _broadcaster = broadcaster;
        _clock = clock;
        _mapRepository = mapRepository;
        _logger = logger;
        _seats = Enumerable.Range(0, options.MaxSeats).Select(i => new Seat(i)).ToArray();
        _lastActivityUtc = clock.UtcNow;
        _pump = Task.Run(PumpAsync);
    }

    public string RoomCode { get; }

    public DateTimeOffset LastActivityUtc => _lastActivityUtc;

    public bool HasConnectedHuman => _seats.Any(s => s.IsConnected);

    private bool TryPost(RoomMessage message) => !_faulted && _mailbox.Writer.TryWrite(message);

    public Task<JoinResult> JoinAsync(string displayName, string? playerToken, string connectionId)
    {
        var tcs = new TaskCompletionSource<JoinResult>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new JoinRequest(displayName, playerToken, connectionId, tcs)))
        {
            return Task.FromResult(JoinResult.Failure("RoomClosed"));
        }
        return tcs.Task;
    }

    public Task<CommandAck> SetSeatAsync(Guid requestingPlayerId, int seatIndex, bool isBot)
    {
        var tcs = new TaskCompletionSource<CommandAck>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new SetSeatRequest(requestingPlayerId, seatIndex, isBot, tcs)))
        {
            return Task.FromResult(CommandAck.Reject("RoomClosed"));
        }
        return tcs.Task;
    }

    public Task<CommandAck> LeaveAsync(Guid playerId)
    {
        var tcs = new TaskCompletionSource<CommandAck>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new LeaveRequest(playerId, tcs)))
        {
            return Task.FromResult(CommandAck.Reject("RoomClosed"));
        }
        return tcs.Task;
    }

    public void NotifyConnectionLost(string connectionId) => TryPost(new ConnectionLost(connectionId));

    public Task<RoomViewDto> GetViewAsync(Guid playerId)
    {
        var tcs = new TaskCompletionSource<RoomViewDto>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new ViewRequest(playerId, tcs)))
        {
            tcs.TrySetException(new InvalidOperationException("Room is closed."));
        }
        return tcs.Task;
    }

    public Task<CommandAck> StartGameAsync(Guid requestingPlayerId)
    {
        var tcs = new TaskCompletionSource<CommandAck>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new StartGameRequest(requestingPlayerId, tcs)))
        {
            return Task.FromResult(CommandAck.Reject("RoomClosed"));
        }
        return tcs.Task;
    }

    public Task<CommandAck> SelectBaseAsync(Guid requestingPlayerId, string regionId)
    {
        var tcs = new TaskCompletionSource<CommandAck>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new SelectBaseRequest(requestingPlayerId, regionId, tcs)))
        {
            return Task.FromResult(CommandAck.Reject("RoomClosed"));
        }
        return tcs.Task;
    }

    public Task<GameViewDto> GetGameViewAsync(Guid playerId)
    {
        var tcs = new TaskCompletionSource<GameViewDto>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new GameViewRequest(playerId, tcs)))
        {
            tcs.TrySetException(new InvalidOperationException("Room is closed."));
        }
        return tcs.Task;
    }

    public Task ShutdownAsync()
    {
        var tcs = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new ShutdownRequest(tcs)))
        {
            return Task.CompletedTask;
        }
        return tcs.Task;
    }

    private async Task PumpAsync()
    {
        await foreach (var message in _mailbox.Reader.ReadAllAsync())
        {
            _lastActivityUtc = _clock.UtcNow;
            try
            {
                await HandleAsync(message);
            }
            catch (Exception ex)
            {
                _faulted = true;
                _logger?.LogError(ex, "Room {RoomCode} faulted; closing", RoomCode);
                _mailbox.Writer.TryComplete();
                return;
            }
        }
    }

    private Task HandleAsync(RoomMessage message) => message switch
    {
        JoinRequest m => HandleJoinAsync(m),
        SetSeatRequest m => HandleSetSeatAsync(m),
        LeaveRequest m => HandleLeaveAsync(m),
        ConnectionLost m => HandleConnectionLostAsync(m),
        ViewRequest m => HandleViewRequest(m),
        StartGameRequest m => HandleStartGameAsync(m),
        SelectBaseRequest m => HandleSelectBaseAsync(m),
        GameViewRequest m => HandleGameViewRequest(m),
        EngineTimerElapsed m => HandleEngineTimerElapsedAsync(m),
        ShutdownRequest m => HandleShutdownAsync(m),
        _ => Task.CompletedTask,
    };

    private async Task HandleJoinAsync(JoinRequest m)
    {
        if (m.PlayerToken is not null)
        {
            var existing = _seats.FirstOrDefault(s => s.PlayerToken == m.PlayerToken);
            if (existing is not null)
            {
                existing.ConnectionId = m.ConnectionId;
                await BroadcastAsync();
                m.Reply.TrySetResult(JoinResult.Ok(existing.PlayerId!.Value, existing.PlayerToken!,
                    BuildView(existing.PlayerId.Value)));
                return;
            }
            // Unknown token: fall through and treat this as a normal new join.
        }

        var openSeat = _seats.FirstOrDefault(s => s.IsOpen);
        if (openSeat is null)
        {
            m.Reply.TrySetResult(JoinResult.Failure("RoomFull"));
            return;
        }

        var playerId = Guid.NewGuid();
        var token = GenerateToken();
        openSeat.IsBot = false;
        openSeat.PlayerId = playerId;
        openSeat.DisplayName = m.DisplayName;
        openSeat.PlayerToken = token;
        openSeat.ConnectionId = m.ConnectionId;

        _hostPlayerId ??= playerId;

        await BroadcastAsync();
        m.Reply.TrySetResult(JoinResult.Ok(playerId, token, BuildView(playerId)));
    }

    private async Task HandleSetSeatAsync(SetSeatRequest m)
    {
        if (_engine is not null)
        {
            m.Reply.TrySetResult(CommandAck.Reject("GameAlreadyStarted"));
            return;
        }
        if (m.RequestingPlayerId != _hostPlayerId)
        {
            m.Reply.TrySetResult(CommandAck.Reject("NotHost"));
            return;
        }
        if (m.SeatIndex < 0 || m.SeatIndex >= _seats.Length)
        {
            m.Reply.TrySetResult(CommandAck.Reject("InvalidSeat"));
            return;
        }

        var seat = _seats[m.SeatIndex];
        if (seat.IsConnected)
        {
            m.Reply.TrySetResult(CommandAck.Reject("SeatOccupiedByHuman"));
            return;
        }

        seat.Clear();
        seat.IsBot = m.IsBot;

        await BroadcastAsync();
        m.Reply.TrySetResult(CommandAck.Ok);
    }

    private async Task HandleLeaveAsync(LeaveRequest m)
    {
        var seat = _seats.FirstOrDefault(s => s.PlayerId == m.PlayerId);
        if (seat is null)
        {
            m.Reply.TrySetResult(CommandAck.Reject("NotSeated"));
            return;
        }

        var wasHost = _hostPlayerId == m.PlayerId;
        seat.Clear();

        if (wasHost)
        {
            _hostPlayerId = _seats.FirstOrDefault(s => s.IsConnected)?.PlayerId;
        }

        await BroadcastAsync();
        m.Reply.TrySetResult(CommandAck.Ok);
    }

    private async Task HandleConnectionLostAsync(ConnectionLost m)
    {
        var seat = _seats.FirstOrDefault(s => s.ConnectionId == m.ConnectionId);
        if (seat is null)
        {
            return; // stale notification for a connection this room never bound
        }
        seat.ConnectionId = null;
        await BroadcastAsync();
    }

    private Task HandleViewRequest(ViewRequest m)
    {
        var seat = _seats.FirstOrDefault(s => s.PlayerId == m.PlayerId);
        if (seat is null)
        {
            m.Reply.TrySetException(new InvalidOperationException("Player is not seated in this room."));
        }
        else
        {
            m.Reply.TrySetResult(BuildView(m.PlayerId));
        }
        return Task.CompletedTask;
    }

    private async Task HandleStartGameAsync(StartGameRequest m)
    {
        if (m.RequestingPlayerId != _hostPlayerId)
        {
            m.Reply.TrySetResult(CommandAck.Reject("NotHost"));
            return;
        }
        if (_engine is not null)
        {
            m.Reply.TrySetResult(CommandAck.Reject("GameAlreadyStarted"));
            return;
        }

        var occupiedSeats = _seats.Where(s => s.IsBot || s.PlayerId is not null)
            .OrderBy(s => s.Index).ToArray();
        var rules = GameRules.Default;
        if (occupiedSeats.Length < rules.MinPlayers)
        {
            m.Reply.TrySetResult(CommandAck.Reject("NotEnoughSeatsFilled"));
            return;
        }

        foreach (var seat in occupiedSeats)
        {
            seat.PlayerId ??= Guid.NewGuid();
        }

        var state = GameState.CreateLobby(_mapRepository.GetDefaultMap(), rules);
        var engine = new GameEngine(state);
        var now = Now();

        foreach (var seat in occupiedSeats)
        {
            engine.Execute(new JoinGame(now, new PlayerId(seat.PlayerId!.Value)));
        }

        var startResult = engine.Execute(new StartGame(now));
        if (!startResult.IsAccepted)
        {
            // Shouldn't happen given the seat-count check above, but never leave a half-built
            // engine sitting in _engine if the domain rejected it for a reason we didn't predict.
            m.Reply.TrySetResult(CommandAck.Reject(startResult.Rejection?.ToString() ?? "StartFailed"));
            return;
        }

        _engine = engine;
        ArmEngineTimer();
        await BroadcastGameViewAsync();
        m.Reply.TrySetResult(CommandAck.Ok);
    }

    private async Task HandleSelectBaseAsync(SelectBaseRequest m)
    {
        if (_engine is null)
        {
            m.Reply.TrySetResult(CommandAck.Reject("GameNotStarted"));
            return;
        }
        if (_engine.State.Pending is not PendingActivity.BasePick pick)
        {
            m.Reply.TrySetResult(CommandAck.Reject("NotAwaitingThisInput"));
            return;
        }

        var result = _engine.Execute(new SelectBase(
            Now(), new PlayerId(m.RequestingPlayerId), pick.Token, new RegionId(m.RegionId)));

        if (!result.IsAccepted)
        {
            m.Reply.TrySetResult(CommandAck.Reject(result.Rejection!.Value.ToString()));
            return;
        }

        ArmEngineTimer();
        await BroadcastGameViewAsync();
        m.Reply.TrySetResult(CommandAck.Ok);
    }

    private Task HandleGameViewRequest(GameViewRequest m)
    {
        if (_engine is null)
        {
            m.Reply.TrySetException(new InvalidOperationException("Game has not started."));
        }
        else
        {
            m.Reply.TrySetResult(BuildGameView(m.PlayerId));
        }
        return Task.CompletedTask;
    }

    private async Task HandleEngineTimerElapsedAsync(EngineTimerElapsed m)
    {
        if (_engine is null)
        {
            return;
        }

        var result = _engine.Execute(new TimeoutElapsed(Now(), m.Token));
        ArmEngineTimer();

        if (result.IsAccepted && result.Events.Length > 0)
        {
            await BroadcastGameViewAsync();
        }
    }

    private async Task HandleShutdownAsync(ShutdownRequest m)
    {
        _engineTimer?.Dispose();
        foreach (var seat in _seats.Where(s => s.IsConnected))
        {
            await _broadcaster.SendClosedAsync(seat.ConnectionId!, "Room closed due to inactivity.");
        }
        _mailbox.Writer.TryComplete();
        m.Done.TrySetResult();
    }

    private async Task BroadcastAsync()
    {
        var sends = _seats.Where(s => s.IsConnected)
            .Select(s => _broadcaster.SendViewAsync(s.ConnectionId!, BuildView(s.PlayerId!.Value)));
        await Task.WhenAll(sends);
    }

    private async Task BroadcastGameViewAsync()
    {
        var sends = _seats.Where(s => s.IsConnected)
            .Select(s => _broadcaster.SendGameViewAsync(s.ConnectionId!, BuildGameView(s.PlayerId!.Value)));
        await Task.WhenAll(sends);
    }

    private RoomViewDto BuildView(Guid viewerId)
    {
        var seats = _seats
            .Select(s => new SeatDto(s.Index, s.PlayerId, s.DisplayName, s.IsBot, s.IsConnected,
                s.PlayerId.HasValue && s.PlayerId == _hostPlayerId))
            .ToArray();
        return new RoomViewDto(RoomCode, viewerId, viewerId == _hostPlayerId, seats);
    }

    private GameViewDto BuildGameView(Guid viewerId)
    {
        var state = _engine!.State;
        var map = _mapRepository.GetDefaultMap();
        var seatsByPlayerId = _seats.Where(s => s.PlayerId is not null).ToDictionary(s => s.PlayerId!.Value);

        var players = state.Players.Select(p =>
        {
            seatsByPlayerId.TryGetValue(p.Id.Value, out var seat);
            return new PlayerViewDto(p.Id.Value, p.Seat, seat?.DisplayName, seat?.IsBot ?? false, p.BaseRegion?.Value);
        }).ToArray();

        var regions = map.Regions.Select(r =>
        {
            var regionState = state.RegionOf(r.Id);
            return new RegionViewDto(r.Id.Value, r.Value, r.RenderPath, regionState.OwnerId?.Value, state.IsBase(r.Id));
        }).ToArray();

        var currentPickerId = state.Pending is PendingActivity.BasePick pick ? pick.Player.Value : (Guid?)null;
        var deadlineUtc = state.Pending is not null
            ? DateTimeOffset.FromUnixTimeMilliseconds(state.Pending.Deadline.UnixMillis)
            : (DateTimeOffset?)null;
        var baseSelectionComplete = state.Phase == GamePhase.BaseSelection && state.Pending is null;

        return new GameViewDto(
            state.Phase,
            _mapRepository.GetDefaultViewBox(),
            regions,
            players,
            currentPickerId,
            deadlineUtc,
            viewerId,
            currentPickerId == viewerId,
            baseSelectionComplete);
    }

    private void ArmEngineTimer()
    {
        _engineTimer?.Dispose();
        _engineTimer = null;

        var pending = _engine?.State.Pending;
        if (pending is null)
        {
            return;
        }

        var token = pending.Token;
        var delay = pending.Deadline.Since(Now());
        var dueTime = delay < TimeSpan.Zero ? TimeSpan.Zero : delay;
        _engineTimer = new Timer(_ => TryPost(new EngineTimerElapsed(token)), null, dueTime, Timeout.InfiniteTimeSpan);
    }

    private Instant Now() => new(_clock.UtcNow.ToUnixTimeMilliseconds());

    private static string GenerateToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(16))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');

    private sealed class Seat(int index)
    {
        public int Index { get; } = index;
        public bool IsBot { get; set; }
        public Guid? PlayerId { get; set; }
        public string? DisplayName { get; set; }
        public string? PlayerToken { get; set; }
        public string? ConnectionId { get; set; }

        public bool IsConnected => ConnectionId is not null;
        public bool IsOpen => !IsBot && PlayerId is null;

        public void Clear()
        {
            IsBot = false;
            PlayerId = null;
            DisplayName = null;
            PlayerToken = null;
            ConnectionId = null;
        }
    }
}
