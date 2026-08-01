using System.Collections.Immutable;
using Triviador.Domain.Primitives;
using Triviador.Domain.Questions;
using Triviador.Domain.Ranking;
using Triviador.Domain.State;

namespace Triviador.Domain.Events;

public interface IGameEvent
{
}

public sealed record PlayerJoined(PlayerId PlayerId, int Seat) : IGameEvent;

public sealed record PlayerLeft(PlayerId PlayerId) : IGameEvent;

public sealed record GameStarted : IGameEvent;

public sealed record BasePickRequested(ActivityToken Token, PlayerId PlayerId, Instant Deadline) : IGameEvent;

public sealed record BaseSelected(PlayerId PlayerId, RegionId RegionId) : IGameEvent;

public sealed record BaseSelectionCompleted : IGameEvent;

public sealed record QuestionAsked(
    ActivityToken Token,
    QuestionPrompt Prompt,
    QuestionPurpose Purpose,
    ImmutableArray<PlayerId> Participants,
    Instant Deadline) : IGameEvent;

public sealed record AnswerAcknowledged(PlayerId PlayerId) : IGameEvent;

public sealed record QuestionResolved(QuestionResult Result) : IGameEvent;

public sealed record RegionPickRequested(
    ActivityToken Token,
    PlayerId PlayerId,
    ImmutableArray<RegionId> EligibleRegionIds,
    Instant Deadline) : IGameEvent;

public sealed record RegionAwarded(PlayerId PlayerId, RegionId RegionId) : IGameEvent;

public sealed record LandGrabCompleted : IGameEvent;
