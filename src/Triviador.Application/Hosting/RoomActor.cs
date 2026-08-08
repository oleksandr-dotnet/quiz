using System.Collections.Immutable;
using System.Security.Cryptography;
using System.Threading.Channels;
using Microsoft.Extensions.Logging;
using Triviador.Application.Accounts;
using Triviador.Application.Content;
using Triviador.Application.Contracts;
using Triviador.Domain.Abstractions;
using Triviador.Domain.Commands;
using Triviador.Domain.Engine;
using Triviador.Domain.Events;
using Triviador.Domain.Primitives;
using Triviador.Domain.Questions;
using Triviador.Domain.Ranking;
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
    private readonly IRandomSourceFactory _randomSourceFactory;
    private readonly IQuestionSourceFactory _questionSourceFactory;
    private readonly ILogger<RoomActor>? _logger;
    private readonly Task _pump;

    private readonly Language _language;
    private Guid? _hostPlayerId;
    private bool _enableAnswerStreaks = true;
    private bool _enableCategoryBanDraft = true;
    private bool _enableGoldenQuestion = true;
    private GameEngine? _engine;
    private Timer? _engineTimer;
    private DateTimeOffset _lastActivityUtc;
    private volatile bool _faulted;

    private IRandomSource? _botRandom;
    private ActivityToken? _botScheduleToken;
    private readonly HashSet<Guid> _scheduledBotPlayers = [];
    private readonly List<Timer> _botTimers = [];

    public RoomActor(string roomCode, RoomOptions options, IRoomBroadcaster broadcaster, IRoomClock clock,
        IMapRepository mapRepository, IRandomSourceFactory randomSourceFactory,
        IQuestionSourceFactory questionSourceFactory, Language language, ILogger<RoomActor>? logger = null)
    {
        RoomCode = roomCode;
        _broadcaster = broadcaster;
        _clock = clock;
        _mapRepository = mapRepository;
        _randomSourceFactory = randomSourceFactory;
        _questionSourceFactory = questionSourceFactory;
        _language = language;
        _logger = logger;
        _seats = Enumerable.Range(0, options.MaxSeats).Select(i => new Seat(i)).ToArray();
        _lastActivityUtc = clock.UtcNow;
        _pump = Task.Run(PumpAsync);
        _logger?.LogInformation("Room {RoomCode} created", RoomCode);
    }

    public string RoomCode { get; }

    public DateTimeOffset LastActivityUtc => _lastActivityUtc;

    public bool HasConnectedHuman => _seats.Any(s => s.IsConnected);

    private bool TryPost(RoomMessage message) => !_faulted && _mailbox.Writer.TryWrite(message);

    public Task<JoinResult> JoinAsync(string displayName, string? playerToken, string connectionId,
        AccountProfileDto? account = null)
    {
        var tcs = new TaskCompletionSource<JoinResult>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new JoinRequest(displayName, playerToken, connectionId, tcs, account)))
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

    public Task<CommandAck> KickPlayerAsync(Guid requestingPlayerId, Guid targetPlayerId, KickLandPolicy landPolicy)
    {
        var tcs = new TaskCompletionSource<CommandAck>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new KickPlayerRequest(requestingPlayerId, targetPlayerId, landPolicy, tcs)))
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

    public Task<CommandAck> SetGameSettingsAsync(
        Guid requestingPlayerId, bool enableAnswerStreaks, bool enableCategoryBanDraft, bool enableGoldenQuestion)
    {
        var tcs = new TaskCompletionSource<CommandAck>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new SetGameSettingsRequest(
                requestingPlayerId, enableAnswerStreaks, enableCategoryBanDraft, enableGoldenQuestion, tcs)))
        {
            return Task.FromResult(CommandAck.Reject("RoomClosed"));
        }
        return tcs.Task;
    }

    public Task<CommandAck> ProposeCategoryBansAsync(Guid requestingPlayerId, IReadOnlyList<string> categoryIds)
    {
        var tcs = new TaskCompletionSource<CommandAck>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new ProposeCategoryBansRequest(requestingPlayerId, categoryIds, tcs)))
        {
            return Task.FromResult(CommandAck.Reject("RoomClosed"));
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

    public Task<CommandAck> SubmitAnswerAsync(Guid requestingPlayerId, AnswerValue answer)
    {
        var tcs = new TaskCompletionSource<CommandAck>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new SubmitAnswerRequest(requestingPlayerId, answer, tcs)))
        {
            return Task.FromResult(CommandAck.Reject("RoomClosed"));
        }
        return tcs.Task;
    }

    public Task<CommandAck> PickRegionAsync(Guid requestingPlayerId, string regionId)
    {
        var tcs = new TaskCompletionSource<CommandAck>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new PickRegionRequest(requestingPlayerId, regionId, tcs)))
        {
            return Task.FromResult(CommandAck.Reject("RoomClosed"));
        }
        return tcs.Task;
    }

    public Task<CommandAck> SelectAttackTargetAsync(Guid requestingPlayerId, string targetRegionId)
    {
        var tcs = new TaskCompletionSource<CommandAck>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new SelectAttackTargetRequest(requestingPlayerId, targetRegionId, tcs)))
        {
            return Task.FromResult(CommandAck.Reject("RoomClosed"));
        }
        return tcs.Task;
    }

    public Task<CommandAck> EmoteAsync(Guid requestingPlayerId, string emoteId)
    {
        var tcs = new TaskCompletionSource<CommandAck>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!TryPost(new EmoteRequest(requestingPlayerId, emoteId, tcs)))
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
        KickPlayerRequest m => HandleKickPlayerAsync(m),
        ConnectionLost m => HandleConnectionLostAsync(m),
        ViewRequest m => HandleViewRequest(m),
        SetGameSettingsRequest m => HandleSetGameSettingsAsync(m),
        ProposeCategoryBansRequest m => HandleProposeCategoryBansAsync(m),
        StartGameRequest m => HandleStartGameAsync(m),
        SelectBaseRequest m => HandleSelectBaseAsync(m),
        SubmitAnswerRequest m => HandleSubmitAnswerAsync(m),
        PickRegionRequest m => HandlePickRegionAsync(m),
        SelectAttackTargetRequest m => HandleSelectAttackTargetAsync(m),
        GameViewRequest m => HandleGameViewRequest(m),
        EmoteRequest m => HandleEmoteAsync(m),
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
                if (_engine is not null)
                {
                    // A reconnect mid-game only got the lobby-shaped RoomView above; without this,
                    // a client that reconnects (refresh, HMR reload, dropped connection) after the
                    // game has started sees no game state until the next command broadcasts one.
                    await _broadcaster.SendGameViewAsync(existing.ConnectionId, BuildGameView(existing.PlayerId!.Value));
                }
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
        // A signed-in caller's account username/avatar always wins over client-supplied text - see
        // player-accounts's "A signed-in account's username and avatar are what other players see".
        // GameHub only ever passes an Account here once it has confirmed setup is complete.
        openSeat.DisplayName = m.Account?.Username ?? m.DisplayName;
        openSeat.AvatarId = m.Account?.AvatarId;
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

        if (_engine is not null)
        {
            // Mid-game: hand the seat to permanent bot control rather than freeing it — the domain
            // engine's GameState.Players still needs this PlayerId as an active participant, so
            // clearing the seat (as the lobby-only path below does) would desync BuildGameView's
            // seatsByPlayerId lookup from the engine's own view of who's still playing.
            seat.IsBot = true;
            seat.ConnectionId = null;

            if (_engine.State.Pending is { } pending)
            {
                ScheduleBotMoves(pending);
            }

            await BroadcastGameViewAsync();
            m.Reply.TrySetResult(CommandAck.Ok);
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

    private async Task HandleKickPlayerAsync(KickPlayerRequest m)
    {
        if (m.RequestingPlayerId != _hostPlayerId)
        {
            m.Reply.TrySetResult(CommandAck.Reject("NotHost"));
            return;
        }
        if (m.TargetPlayerId == m.RequestingPlayerId)
        {
            m.Reply.TrySetResult(CommandAck.Reject("CannotKickSelf"));
            return;
        }

        var seat = _seats.FirstOrDefault(s => s.PlayerId == m.TargetPlayerId);
        if (seat is null)
        {
            m.Reply.TrySetResult(CommandAck.Reject("NotSeated"));
            return;
        }

        var kickedConnectionId = seat.ConnectionId;

        if (_engine is null)
        {
            // Lobby: no territory exists yet, so the land policy is irrelevant — a kick is a plain
            // seat clear, identical to that player voluntarily leaving (HandleLeaveAsync's lobby
            // branch), except the host reassignment logic there never applies (the target can't be
            // host, since a host can't target themselves above).
            seat.Clear();
            await BroadcastAsync();
        }
        else if (m.LandPolicy == KickLandPolicy.BotTakeover)
        {
            // Exactly HandleLeaveAsync's mid-game branch, plus invalidating the token — a voluntary
            // leave has no reason to block a future rejoin, but a kick must.
            seat.IsBot = true;
            seat.ConnectionId = null;
            seat.PlayerToken = null;

            if (_engine.State.Pending is { } pending)
            {
                ScheduleBotMoves(pending);
            }

            await BroadcastGameViewAsync();
        }
        else
        {
            var result = _engine.Execute(new WithdrawPlayer(Now(), new PlayerId(m.TargetPlayerId)));
            if (!result.IsAccepted)
            {
                m.Reply.TrySetResult(CommandAck.Reject(result.Rejection!.Value.ToString()));
                return;
            }

            // Seat.PlayerId stays set (per design Decision D5) so IsOpen stays false — a mid-game
            // seat must never become newly joinable, matching JoinGame's Lobby-only domain invariant.
            seat.ConnectionId = null;
            seat.PlayerToken = null;

            LogNotableEvents(result.Events);
            ArmEngineTimer();
            await BroadcastGameViewAsync();
        }

        if (kickedConnectionId is not null)
        {
            await _broadcaster.SendKickedAsync(kickedConnectionId, "HostKicked");
        }

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

        // Mirrors every other seat-mutating handler's phase check (e.g. HandleLeaveAsync): once the
        // game has started, clients render GameView, not the lobby-shaped RoomView, so broadcasting
        // only BuildView here left a mid-game disconnect invisible to everyone else until the next
        // unrelated game broadcast happened to carry it along.
        if (_engine is not null)
        {
            await BroadcastGameViewAsync();
        }
        else
        {
            await BroadcastAsync();
        }
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

    private async Task HandleSetGameSettingsAsync(SetGameSettingsRequest m)
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

        _enableAnswerStreaks = m.EnableAnswerStreaks;
        _enableCategoryBanDraft = m.EnableCategoryBanDraft;
        _enableGoldenQuestion = m.EnableGoldenQuestion;

        await BroadcastAsync();
        m.Reply.TrySetResult(CommandAck.Ok);
    }

    private async Task HandleProposeCategoryBansAsync(ProposeCategoryBansRequest m)
    {
        if (_engine is null)
        {
            m.Reply.TrySetResult(CommandAck.Reject("GameNotStarted"));
            return;
        }
        if (_engine.State.Pending is not PendingActivity.CategoryBanProposal pending)
        {
            m.Reply.TrySetResult(CommandAck.Reject("NotAwaitingThisInput"));
            return;
        }

        var categories = m.CategoryIds.Select(id => new CategoryId(id)).ToImmutableArray();
        var result = _engine.Execute(new ProposeCategoryBans(
            Now(), new PlayerId(m.RequestingPlayerId), pending.Token, categories));

        if (!result.IsAccepted)
        {
            m.Reply.TrySetResult(CommandAck.Reject(result.Rejection!.Value.ToString()));
            return;
        }

        LogNotableEvents(result.Events);
        ArmEngineTimer();
        await BroadcastGameViewAsync(ExtractLastReveal(result.Events));
        m.Reply.TrySetResult(CommandAck.Ok);
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
        var rules = GameRules.Default with
        {
            Language = _language,
            EnableAnswerStreaks = _enableAnswerStreaks,
            EnableCategoryBanDraft = _enableCategoryBanDraft,
            EnableGoldenQuestion = _enableGoldenQuestion,
        };
        if (occupiedSeats.Length < rules.MinPlayers)
        {
            m.Reply.TrySetResult(CommandAck.Reject("NotEnoughSeatsFilled"));
            return;
        }

        foreach (var seat in occupiedSeats)
        {
            seat.PlayerId ??= Guid.NewGuid();
        }

        var seed = RandomNumberGenerator.GetInt32(int.MinValue, int.MaxValue);
        var state = GameState.CreateLobby(_mapRepository.GetDefaultMap(), rules);
        var engine = new GameEngine(state, _randomSourceFactory.Create(seed), _questionSourceFactory.Create(seed, rules.Language));
        var now = Now();

        // A separate seed/source dedicated to bot choices and thinking-delays, kept independent of
        // the engine's own random source so bot behavior never perturbs the engine's draw sequence
        // (part of what keeps a game replayable from (seed, command log)).
        var botSeed = RandomNumberGenerator.GetInt32(int.MinValue, int.MaxValue);
        _botRandom = _randomSourceFactory.Create(botSeed);

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
        _logger?.LogInformation("Room {RoomCode} started with {PlayerCount} players", RoomCode, occupiedSeats.Length);
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

        LogNotableEvents(result.Events);
        ArmEngineTimer();
        await BroadcastGameViewAsync(ExtractLastReveal(result.Events));
        m.Reply.TrySetResult(CommandAck.Ok);
    }

    private async Task HandleSubmitAnswerAsync(SubmitAnswerRequest m)
    {
        if (_engine is null)
        {
            m.Reply.TrySetResult(CommandAck.Reject("GameNotStarted"));
            return;
        }
        if (_engine.State.Pending is not PendingActivity.Question pending)
        {
            m.Reply.TrySetResult(CommandAck.Reject("NotAwaitingThisInput"));
            return;
        }

        var result = _engine.Execute(new SubmitAnswer(
            Now(), new PlayerId(m.RequestingPlayerId), pending.Token, m.Answer));

        if (!result.IsAccepted)
        {
            m.Reply.TrySetResult(CommandAck.Reject(result.Rejection!.Value.ToString()));
            return;
        }

        LogNotableEvents(result.Events);
        ArmEngineTimer();
        await BroadcastGameViewAsync(ExtractLastReveal(result.Events));
        m.Reply.TrySetResult(CommandAck.Ok);
    }

    private async Task HandlePickRegionAsync(PickRegionRequest m)
    {
        if (_engine is null)
        {
            m.Reply.TrySetResult(CommandAck.Reject("GameNotStarted"));
            return;
        }
        if (_engine.State.Pending is not PendingActivity.RegionPicks pending)
        {
            m.Reply.TrySetResult(CommandAck.Reject("NotAwaitingThisInput"));
            return;
        }

        var result = _engine.Execute(new PickRegion(
            Now(), new PlayerId(m.RequestingPlayerId), pending.Token, new RegionId(m.RegionId)));

        if (!result.IsAccepted)
        {
            m.Reply.TrySetResult(CommandAck.Reject(result.Rejection!.Value.ToString()));
            return;
        }

        LogNotableEvents(result.Events);
        ArmEngineTimer();
        await BroadcastGameViewAsync(ExtractLastReveal(result.Events));
        m.Reply.TrySetResult(CommandAck.Ok);
    }

    private async Task HandleSelectAttackTargetAsync(SelectAttackTargetRequest m)
    {
        if (_engine is null)
        {
            m.Reply.TrySetResult(CommandAck.Reject("GameNotStarted"));
            return;
        }
        if (_engine.State.Pending is not PendingActivity.TargetSelection pending)
        {
            m.Reply.TrySetResult(CommandAck.Reject("NotAwaitingThisInput"));
            return;
        }

        var result = _engine.Execute(new SelectAttackTarget(
            Now(), new PlayerId(m.RequestingPlayerId), pending.Token, new RegionId(m.TargetRegionId)));

        if (!result.IsAccepted)
        {
            m.Reply.TrySetResult(CommandAck.Reject(result.Rejection!.Value.ToString()));
            return;
        }

        LogNotableEvents(result.Events);
        ArmEngineTimer();
        await BroadcastGameViewAsync(ExtractLastReveal(result.Events));
        m.Reply.TrySetResult(CommandAck.Ok);
    }

    private static (QuestionResult Result, bool IsGolden)? ExtractLastReveal(ImmutableArray<IGameEvent> events)
    {
        var result = events.OfType<QuestionResolved>().Select(e => e.Result).LastOrDefault();
        return result is null ? null : (result, events.OfType<GoldenQuestionRevealed>().Any());
    }

    // Only the rare, high-value events get an Information log here - a region captured in an
    // ordinary duel, a round advancing, or a question asked/resolved happen many times per game and
    // would dominate the log if logged at this level; a rejected command is logged separately by
    // GameHub regardless of frequency.
    private void LogNotableEvents(ImmutableArray<IGameEvent> events)
    {
        if (_logger is null)
        {
            return;
        }

        foreach (var e in events)
        {
            switch (e)
            {
                case PlayerEliminated pe:
                    _logger.LogInformation("Room {RoomCode}: player {PlayerId} eliminated", RoomCode, pe.PlayerId.Value);
                    break;
                case BaseCaptured bc:
                    _logger.LogInformation("Room {RoomCode}: {Attacker} captured {Defender}'s base {Region}",
                        RoomCode, bc.AttackerId.Value, bc.DefenderId.Value, bc.BaseRegionId.Value);
                    break;
                case BaseAssaultScoreAdjusted sa:
                    _logger.LogInformation(
                        "Room {RoomCode}: base-assault score adjusted, attacker {Attacker} {AttackerDelta}, defender {Defender} {DefenderDelta}",
                        RoomCode, sa.AttackerId.Value, sa.AttackerDelta, sa.DefenderId.Value, sa.DefenderDelta);
                    break;
                case DuelDefenseScoreAwarded dd:
                    _logger.LogInformation(
                        "Room {RoomCode}: duel-defense score awarded, defender {Defender} +{Amount} for {Region} (attacker {Attacker})",
                        RoomCode, dd.DefenderId.Value, dd.Amount, dd.RegionId.Value, dd.AttackerId.Value);
                    break;
                case CategoryBansResolved cb:
                    _logger.LogInformation("Room {RoomCode}: category ban draft resolved, banned {Categories}",
                        RoomCode, string.Join(", ", cb.BannedCategories.Select(c => c.Value)));
                    break;
                case GameFinished gf:
                    _logger.LogInformation("Room {RoomCode}: game finished, winner(s) {Winners}",
                        RoomCode, string.Join(", ", gf.Outcome.Winners.Select(w => w.Value)));
                    break;
            }
        }
    }

    // Keep in sync with the client's EMOTES list (emotes.ts) - a closed set rather than free text,
    // so a room never has to render/sanitize arbitrary strings broadcast by another player.
    private static readonly HashSet<string> ValidEmoteIds =
        ["gg", "lol", "wow", "cry", "angry", "thinking", "crown", "clown", "fire"];

    private async Task HandleEmoteAsync(EmoteRequest m)
    {
        if (!ValidEmoteIds.Contains(m.EmoteId))
        {
            m.Reply.TrySetResult(CommandAck.Reject("UnknownEmote"));
            return;
        }

        var sender = _seats.FirstOrDefault(s => s.PlayerId == m.RequestingPlayerId);
        if (sender is null)
        {
            m.Reply.TrySetResult(CommandAck.Reject("NotSeated"));
            return;
        }

        var sends = _seats.Where(s => s.IsConnected)
            .Select(s => _broadcaster.SendEmoteAsync(s.ConnectionId!, m.RequestingPlayerId, m.EmoteId));
        await Task.WhenAll(sends);
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
            LogNotableEvents(result.Events);
            await BroadcastGameViewAsync(ExtractLastReveal(result.Events));
        }
    }

    private async Task HandleShutdownAsync(ShutdownRequest m)
    {
        _logger?.LogInformation("Room {RoomCode} shutting down", RoomCode);
        _engineTimer?.Dispose();
        ClearBotSchedule();
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

    private async Task BroadcastGameViewAsync((QuestionResult Result, bool IsGolden)? lastReveal = null)
    {
        var sends = _seats.Where(s => s.IsConnected)
            .Select(s => _broadcaster.SendGameViewAsync(s.ConnectionId!, BuildGameView(s.PlayerId!.Value, lastReveal)));
        await Task.WhenAll(sends);
    }

    private RoomViewDto BuildView(Guid viewerId)
    {
        var seats = _seats
            .Select(s => new SeatDto(s.Index, s.PlayerId, s.DisplayName, s.AvatarId, s.IsBot, s.IsConnected,
                s.PlayerId.HasValue && s.PlayerId == _hostPlayerId))
            .ToArray();
        var gameSettings = new GameSettingsDto(_enableAnswerStreaks, _enableCategoryBanDraft, _enableGoldenQuestion);
        return new RoomViewDto(RoomCode, viewerId, viewerId == _hostPlayerId, seats, _language, gameSettings);
    }

    private GameViewDto BuildGameView(Guid viewerId, (QuestionResult Result, bool IsGolden)? lastReveal = null)
    {
        var state = _engine!.State;
        var map = _mapRepository.GetDefaultMap();
        var seatsByPlayerId = _seats.Where(s => s.PlayerId is not null).ToDictionary(s => s.PlayerId!.Value);

        var players = state.Players.Select(p =>
        {
            seatsByPlayerId.TryGetValue(p.Id.Value, out var seat);
            // A bot never holds a live SignalR connection, but it never misses a turn either - it
            // always resolves by timeout like any other bot action. Showing it as "disconnected"
            // would read as broken, not intentional, so bots are always reported connected here.
            var isConnected = seat is null || seat.IsBot || seat.IsConnected;
            return new PlayerViewDto(
                p.Id.Value, p.Seat, seat?.DisplayName, seat?.AvatarId, seat?.IsBot ?? false, isConnected,
                p.BaseRegion?.Value, state.ScoreOf(p.Id), p.Eliminated, p.BaseRegion is not null ? p.BaseHitPoints : null,
                p.Withdrawn, p.AnswerStreak);
        }).ToArray();

        var regions = map.Regions.Select(r =>
        {
            var regionState = state.RegionOf(r.Id);
            var name = state.Rules.Language == Language.Russian ? r.NameRu : r.NameEn;
            return new RegionViewDto(
                r.Id.Value, name, r.Value, r.CenterX, r.CenterY, r.Radius, r.LabelX, r.LabelY,
                r.AdjacentTo.Select(a => a.Value).ToArray(),
                regionState.OwnerId?.Value, state.IsBase(r.Id));
        }).ToArray();

        var currentPickerId = state.Pending is PendingActivity.BasePick pick ? pick.Player.Value : (Guid?)null;
        var basePickDeadlineUtc = state.Pending is PendingActivity.BasePick basePick
            ? DateTimeOffset.FromUnixTimeMilliseconds(basePick.Deadline.UnixMillis)
            : (DateTimeOffset?)null;

        PendingBasePickViewDto? pendingBasePick = state.Pending is PendingActivity.BasePick basePickActivity
            ? new PendingBasePickViewDto(
                basePickActivity.Player.Value,
                _engine.EligibleBaseRegions().Select(r => r.Value).ToArray(),
                DateTimeOffset.FromUnixTimeMilliseconds(basePickActivity.Deadline.UnixMillis))
            : null;

        PendingCategoryBanViewDto? pendingCategoryBan = null;
        if (state.Pending is PendingActivity.CategoryBanProposal categoryBan)
        {
            var hasSubmitted = categoryBan.Participants.ToDictionary(
                p => p.Value.ToString(), p => categoryBan.Proposals.ContainsKey(p));
            var yourProposal = categoryBan.Proposals.TryGetValue(new PlayerId(viewerId), out var proposal)
                ? proposal.Select(c => c.Value).ToArray()
                : null;
            pendingCategoryBan = new PendingCategoryBanViewDto(
                categoryBan.AvailableCategories.Select(c => c.Value).ToArray(),
                hasSubmitted,
                yourProposal,
                DateTimeOffset.FromUnixTimeMilliseconds(categoryBan.Deadline.UnixMillis));
        }

        var bannedCategories = state.BannedCategories.Select(c => c.Value).ToArray();

        PendingQuestionViewDto? pendingQuestion = null;
        PendingRegionPickViewDto? pendingRegionPick = null;

        if (state.Pending is PendingActivity.Question question)
        {
            var hasAnswered = question.Participants.ToDictionary(p => p.Value.ToString(), p => question.Submissions.ContainsKey(p));
            var yourAnswer = question.Submissions.TryGetValue(new PlayerId(viewerId), out var submission)
                ? ToAnswerDto(submission.Answer)
                : null;
            pendingQuestion = new PendingQuestionViewDto(
                ToPromptDto(question.Q.Prompt),
                question.Participants.Select(p => p.Value).ToArray(),
                hasAnswered,
                yourAnswer,
                DateTimeOffset.FromUnixTimeMilliseconds(question.Deadline.UnixMillis));
        }
        else if (state.Pending is PendingActivity.RegionPicks regionPicks)
        {
            var picker = regionPicks.AwardQueue[regionPicks.NextIndex];
            var eligible = _engine.EligibleRegionsFor(picker).Select(r => r.Value).ToArray();
            pendingRegionPick = new PendingRegionPickViewDto(
                picker.Value,
                eligible,
                DateTimeOffset.FromUnixTimeMilliseconds(regionPicks.Deadline.UnixMillis));
        }

        PendingAttackTargetViewDto? pendingAttackTarget = null;
        PendingRevealViewDto? pendingReveal = null;

        if (state.Pending is PendingActivity.TargetSelection targetSelection)
        {
            var eligibleTargets = _engine.EligibleAttackTargetsFor(targetSelection.Player).Select(r => r.Value).ToArray();
            pendingAttackTarget = new PendingAttackTargetViewDto(
                targetSelection.Player.Value,
                eligibleTargets,
                DateTimeOffset.FromUnixTimeMilliseconds(targetSelection.Deadline.UnixMillis));
        }
        else if (state.Pending is PendingActivity.RevealHold revealHold)
        {
            pendingReveal = ToPendingRevealDto(revealHold);
        }

        var outcome = state.Outcome is not null
            ? new GameOutcomeDto(state.Outcome.Winners.Select(w => w.Value).ToArray())
            : null;

        var battle = state.Pending switch
        {
            PendingActivity.Question q => ToBattleContext(q.Purpose),
            PendingActivity.RevealHold r => ToBattleContext(r.Purpose),
            _ => null,
        };

        return new GameViewDto(
            state.Phase,
            _mapRepository.GetDefaultViewBox(),
            regions,
            players,
            currentPickerId,
            basePickDeadlineUtc,
            viewerId,
            currentPickerId == viewerId,
            pendingQuestion,
            pendingRegionPick,
            lastReveal is { } reveal ? ToRevealDto(reveal.Result, reveal.IsGolden) : null,
            state.CurrentRound,
            pendingAttackTarget,
            pendingReveal,
            outcome,
            pendingBasePick,
            battle,
            state.Rules.Language,
            state.Rules.RoundLimit,
            pendingCategoryBan,
            bannedCategories);
    }

    // Every field here is a fact both combatants already know (identities, the contested region,
    // assault progress) - never an in-flight answer or the correct answer, matching the secrecy
    // guarantee PendingQuestionViewDto/PendingRevealViewDto already hold for the question itself.
    private static BattleContextDto? ToBattleContext(QuestionPurpose purpose) => purpose switch
    {
        QuestionPurpose.Duel duel => new BattleContextDto(
            BattleKindDto.Duel, duel.Region.Value, duel.Attacker.Value, duel.Defender.Value, null, null, false),
        QuestionPurpose.BaseAssault assault => new BattleContextDto(
            BattleKindDto.BaseAssault, assault.BaseRegion.Value, assault.Attacker.Value, assault.Defender.Value,
            assault.QuestionIndex, assault.DamageDealtThisTurn, false),
        QuestionPurpose.NumericTiebreak tiebreak => ToBattleContext(tiebreak.Original) is { } inner
            ? inner with { IsTiebreakRound = true }
            : null,
        _ => null,
    };

    private static QuestionPromptDto ToPromptDto(QuestionPrompt prompt) =>
        new(prompt.Id.Value, prompt.Kind, prompt.Text, prompt.Options, prompt.Unit);

    private static AnswerValueDto ToAnswerDto(AnswerValue answer) => answer switch
    {
        AnswerValue.Choice c => AnswerValueDto.OfChoice(c.OptionIndex),
        AnswerValue.Numeric n => AnswerValueDto.OfNumeric(n.Value),
        _ => AnswerValueDto.None,
    };

    private static LastRevealDto ToRevealDto(QuestionResult result, bool isGolden)
    {
        var correct = result.Question.Prompt.Kind == QuestionKind.Choice
            ? AnswerValueDto.OfChoice(result.Question.CorrectOptionIndex ?? 0)
            : AnswerValueDto.OfNumeric(result.Question.CorrectNumericValue ?? 0);

        var answers = result.Rankings
            .Select(r => new RevealedAnswerDto(r.Player.Value, ToAnswerDto(r.Answer), r.Rank, (long?)r.Elapsed?.TotalMilliseconds))
            .ToArray();

        return new LastRevealDto(ToPromptDto(result.Question.Prompt), correct, answers, isGolden);
    }

    private static PendingRevealViewDto ToPendingRevealDto(PendingActivity.RevealHold hold)
    {
        var result = hold.Result;
        var correct = result.Question.Prompt.Kind == QuestionKind.Choice
            ? AnswerValueDto.OfChoice(result.Question.CorrectOptionIndex ?? 0)
            : AnswerValueDto.OfNumeric(result.Question.CorrectNumericValue ?? 0);

        var answers = result.Rankings
            .Select(r => new RevealedAnswerDto(r.Player.Value, ToAnswerDto(r.Answer), r.Rank, (long?)r.Elapsed?.TotalMilliseconds))
            .ToArray();

        return new PendingRevealViewDto(
            ToPromptDto(result.Question.Prompt),
            correct,
            answers,
            DateTimeOffset.FromUnixTimeMilliseconds(hold.Deadline.UnixMillis),
            hold.IsGolden);
    }

    private void ArmEngineTimer()
    {
        _engineTimer?.Dispose();
        _engineTimer = null;

        var pending = _engine?.State.Pending;
        if (pending is null)
        {
            ClearBotSchedule();
            return;
        }

        var token = pending.Token;
        var delay = pending.Deadline.Since(Now());
        var dueTime = delay < TimeSpan.Zero ? TimeSpan.Zero : delay;
        _engineTimer = new Timer(_ => TryPost(new EngineTimerElapsed(token)), null, dueTime, Timeout.InfiniteTimeSpan);

        ScheduleBotMoves(pending);
    }

    // Bots submit through the same public methods a human client uses (SelectBaseAsync,
    // PickRegionAsync, SubmitAnswerAsync, SelectAttackTargetAsync), so they get the exact same
    // validation for free and can never do anything a human couldn't. A stale/rejected bot
    // submission is a harmless no-op, the same way a stale TimeoutElapsed already is.
    private void ScheduleBotMoves(PendingActivity pending)
    {
        if (_botScheduleToken != pending.Token)
        {
            ClearBotSchedule();
            _botScheduleToken = pending.Token;
        }

        switch (pending)
        {
            case PendingActivity.CategoryBanProposal categoryBan:
                foreach (var participant in categoryBan.Participants)
                {
                    if (!categoryBan.Proposals.ContainsKey(participant))
                    {
                        ScheduleBotCategoryBanProposal(participant.Value, pending.Deadline, categoryBan.AvailableCategories);
                    }
                }
                break;

            case PendingActivity.BasePick basePick:
                ScheduleBotRegionChoice(basePick.Player.Value, pending.Deadline,
                    () => _engine!.EligibleBaseRegions(),
                    (playerId, regionId) => SelectBaseAsync(playerId, regionId));
                break;

            case PendingActivity.RegionPicks regionPicks:
                var picker = regionPicks.AwardQueue[regionPicks.NextIndex];
                ScheduleBotRegionChoice(picker.Value, pending.Deadline,
                    () => _engine!.EligibleRegionsFor(picker),
                    (playerId, regionId) => PickRegionAsync(playerId, regionId));
                break;

            case PendingActivity.TargetSelection targetSelection:
                ScheduleBotRegionChoice(targetSelection.Player.Value, pending.Deadline,
                    () => _engine!.EligibleAttackTargetsFor(targetSelection.Player),
                    (playerId, regionId) => SelectAttackTargetAsync(playerId, regionId));
                break;

            case PendingActivity.Question question:
                foreach (var participant in question.Participants)
                {
                    if (!question.Submissions.ContainsKey(participant))
                    {
                        ScheduleBotAnswer(participant.Value, pending.Deadline, question.Q.Prompt);
                    }
                }
                break;
        }
    }

    private void ScheduleBotRegionChoice(
        Guid playerId, Instant deadline, Func<ImmutableArray<RegionId>> eligible, Func<Guid, string, Task> submit)
    {
        if (!IsBotPlayer(playerId) || !_scheduledBotPlayers.Add(playerId))
        {
            return;
        }

        var regionId = BotChoice.PickRegion(eligible(), _botRandom!);
        var delay = BotChoice.ThinkingDelay(deadline.Since(Now()), _botRandom!);
        _botTimers.Add(new Timer(_ => submit(playerId, regionId.Value), null, delay, Timeout.InfiniteTimeSpan));
    }

    private void ScheduleBotCategoryBanProposal(Guid playerId, Instant deadline, ImmutableArray<CategoryId> available)
    {
        if (!IsBotPlayer(playerId) || !_scheduledBotPlayers.Add(playerId))
        {
            return;
        }

        var picks = BotChoice.PickCategoryBans(available, _botRandom!);
        var delay = BotChoice.ThinkingDelay(deadline.Since(Now()), _botRandom!);
        var categoryIds = picks.Select(c => c.Value).ToArray();
        _botTimers.Add(new Timer(_ => ProposeCategoryBansAsync(playerId, categoryIds), null, delay, Timeout.InfiniteTimeSpan));
    }

    private void ScheduleBotAnswer(Guid playerId, Instant deadline, QuestionPrompt prompt)
    {
        if (!IsBotPlayer(playerId) || !_scheduledBotPlayers.Add(playerId))
        {
            return;
        }

        var answer = BotChoice.Answer(prompt, _botRandom!);
        var delay = BotChoice.ThinkingDelay(deadline.Since(Now()), _botRandom!);
        _botTimers.Add(new Timer(_ => SubmitAnswerAsync(playerId, answer), null, delay, Timeout.InfiniteTimeSpan));
    }

    private bool IsBotPlayer(Guid playerId) => _seats.Any(s => s.PlayerId == playerId && s.IsBot);

    private void ClearBotSchedule()
    {
        foreach (var timer in _botTimers)
        {
            timer.Dispose();
        }
        _botTimers.Clear();
        _scheduledBotPlayers.Clear();
        _botScheduleToken = null;
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
        public string? AvatarId { get; set; }
        public string? PlayerToken { get; set; }
        public string? ConnectionId { get; set; }

        public bool IsConnected => ConnectionId is not null;
        public bool IsOpen => !IsBot && PlayerId is null;

        public void Clear()
        {
            IsBot = false;
            PlayerId = null;
            DisplayName = null;
            AvatarId = null;
            PlayerToken = null;
            ConnectionId = null;
        }
    }
}
