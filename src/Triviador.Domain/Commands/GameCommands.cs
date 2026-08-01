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

public sealed record SelectBase(Instant At, PlayerId PlayerId, ActivityToken Token, RegionId RegionId) : IGameCommand;

public sealed record SubmitAnswer(Instant At, PlayerId PlayerId, ActivityToken Token, AnswerValue Answer) : IGameCommand;

public sealed record PickRegion(Instant At, PlayerId PlayerId, ActivityToken Token, RegionId RegionId) : IGameCommand;

public sealed record TimeoutElapsed(Instant At, ActivityToken Token) : IGameCommand;
