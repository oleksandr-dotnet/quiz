using System.Collections.Immutable;
using Triviador.Domain.Events;

namespace Triviador.Domain.Primitives;

public sealed record CommandResult(bool IsAccepted, RejectionCode? Rejection, ImmutableArray<IGameEvent> Events)
{
    public static CommandResult Accepted(ImmutableArray<IGameEvent> events) => new(true, null, events);

    public static CommandResult Accepted(params IGameEvent[] events) => new(true, null, events.ToImmutableArray());

    public static CommandResult Rejected(RejectionCode code) => new(false, code, ImmutableArray<IGameEvent>.Empty);
}
