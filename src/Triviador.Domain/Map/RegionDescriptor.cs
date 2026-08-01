using System.Collections.Immutable;
using Triviador.Domain.Primitives;

namespace Triviador.Domain.Map;

public sealed record RegionDescriptor(
    RegionId Id, string NameEn, string NameRu, int Value,
    double CenterX, double CenterY, double Radius,
    double LabelX, double LabelY, ImmutableArray<RegionId> AdjacentTo);
