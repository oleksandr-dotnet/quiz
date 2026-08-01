using System.Collections.Immutable;
using Triviador.Domain.Primitives;

namespace Triviador.Domain.Map;

public sealed record RegionDescriptor(RegionId Id, int Value, string RenderPath, ImmutableArray<RegionId> AdjacentTo);
