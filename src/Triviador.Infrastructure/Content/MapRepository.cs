using System.Collections.Immutable;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Triviador.Application.Content;
using Triviador.Domain.Map;
using Triviador.Domain.Primitives;

namespace Triviador.Infrastructure.Content;

public sealed class MapRepository : IMapRepository
{
    private readonly MapDescriptor _map;
    private readonly string _viewBox;

    public MapRepository(IHostEnvironment environment)
    {
        var path = Path.Combine(environment.ContentRootPath, "Data", "map.json");
        var json = File.ReadAllText(path);
        var raw = JsonSerializer.Deserialize<MapJson>(json, JsonOptions)
            ?? throw new InvalidOperationException($"'{path}' did not deserialize to a map.");

        _viewBox = raw.ViewBox;
        _map = new MapDescriptor(
            raw.Id,
            raw.Regions
                .Select(r => new RegionDescriptor(
                    new RegionId(r.Id),
                    r.Value,
                    r.RenderPath,
                    r.AdjacentTo.Select(a => new RegionId(a)).ToImmutableArray()))
                .ToImmutableArray());

        var result = MapValidator.Validate(_map);
        if (!result.IsValid)
        {
            throw new InvalidOperationException(
                $"'{path}' failed map validation:\n" + string.Join('\n', result.Errors));
        }
    }

    public MapDescriptor GetDefaultMap() => _map;

    public string GetDefaultViewBox() => _viewBox;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() },
    };

    private sealed record MapJson(string Id, string ViewBox, ImmutableArray<RegionJson> Regions);

    private sealed record RegionJson(string Id, int Value, string RenderPath, ImmutableArray<string> AdjacentTo);
}
