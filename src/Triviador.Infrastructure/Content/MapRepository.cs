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
        foreach (var region in raw.Regions)
        {
            if (string.IsNullOrWhiteSpace(region.NameEn) || string.IsNullOrWhiteSpace(region.NameRu))
            {
                throw new InvalidOperationException(
                    $"'{path}' has a region '{region.Id}' missing its English or Russian name.");
            }
        }

        _map = new MapDescriptor(
            raw.Id,
            raw.Regions
                .Select(r => new RegionDescriptor(
                    new RegionId(r.Id),
                    r.NameEn,
                    r.NameRu,
                    r.Value,
                    r.CenterX,
                    r.CenterY,
                    r.Radius,
                    r.LabelX,
                    r.LabelY,
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

    private sealed record RegionJson(
        string Id, string NameEn, string NameRu, int Value,
        double CenterX, double CenterY, double Radius,
        double LabelX, double LabelY, ImmutableArray<string> AdjacentTo);
}
