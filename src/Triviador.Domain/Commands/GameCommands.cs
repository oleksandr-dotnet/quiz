using System.Collections.Immutable;
using Triviador.Domain.Primitives;
using Triviador.Domain.Questions;

namespace Triviador.Domain.Commands;

public interface IGameCommand
{
    Instant At { get; }
}

public sealed record JoinGame(Instant At, PlayerId PlayerId) : IGameCommand;

public sealed record LeaveGame(Instant At, PlayerId PlayerId) : IGameCommand;

public sealed record StartGame(Instant At) : IGameCommand;

/// Up to 3 categories a player would like banned for this game - see category-ban-draft. Legal only
/// while GamePhase.CategoryBan is pending, once per active player.
public sealed record ProposeCategoryBans(
    Instant At, PlayerId PlayerId, ActivityToken Token, ImmutableArray<CategoryId> Categories) : IGameCommand;

public sealed record SelectBase(Instant At, PlayerId PlayerId, ActivityToken Token, RegionId RegionId) : IGameCommand;

public sealed record SubmitAnswer(Instant At, PlayerId PlayerId, ActivityToken Token, AnswerValue Answer) : IGameCommand;

public sealed record PickRegion(Instant At, PlayerId PlayerId, ActivityToken Token, RegionId RegionId) : IGameCommand;

public sealed record SelectAttackTarget(Instant At, PlayerId PlayerId, ActivityToken Token, RegionId TargetRegionId) : IGameCommand;

public sealed record TimeoutElapsed(Instant At, ActivityToken Token) : IGameCommand;

/// Host-initiated removal with territory release (see host-kick-player). Distinct from LeaveGame:
/// this works at any post-Lobby phase and never assigns the target new territory afterward, whereas
/// LeaveGame is Lobby-only and self-service. The "hand seat to a bot" disposition never reaches the
/// domain at all — bots are invisible to GameEngine, so that path is pure RoomActor seat bookkeeping.
public sealed record WithdrawPlayer(Instant At, PlayerId PlayerId) : IGameCommand;
