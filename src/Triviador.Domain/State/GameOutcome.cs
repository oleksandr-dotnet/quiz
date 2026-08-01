using System.Collections.Immutable;
using Triviador.Domain.Primitives;

namespace Triviador.Domain.State;

public sealed record GameOutcome(ImmutableArray<PlayerId> Winners);
