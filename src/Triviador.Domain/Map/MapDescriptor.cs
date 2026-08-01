using System.Collections.Immutable;

namespace Triviador.Domain.Map;

// Canonical iteration order: regions are enumerated in this array's declaration order everywhere in
// the engine — never re-sorted, never iterated via a Dictionary.
public sealed record MapDescriptor(string Id, ImmutableArray<RegionDescriptor> Regions);
