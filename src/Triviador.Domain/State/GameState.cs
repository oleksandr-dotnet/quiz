using System.Collections.Immutable;
using System.Text;
using Triviador.Domain.Map;
using Triviador.Domain.Primitives;

namespace Triviador.Domain.State;

public sealed class GameState
{
    private readonly List<PlayerState> _players = [];
    private readonly Dictionary<RegionId, RegionState> _regionsById;
    private int _nextSeat;

    private GameState(MapDescriptor map, GameRules rules)
    {
        Map = map;
        Rules = rules;
        Regions = map.Regions.Select(r => new RegionState { Id = r.Id }).ToImmutableArray();
        _regionsById = Regions.ToDictionary(r => r.Id);
        NextActivityToken = ActivityToken.First;
    }

    public static GameState CreateLobby(MapDescriptor map, GameRules rules) => new(map, rules);

    public MapDescriptor Map { get; }

    public GameRules Rules { get; }

    public GamePhase Phase { get; internal set; } = GamePhase.Lobby;

    // Canonical seat order: players are only ever appended with a monotonically increasing seat
    // number, so this list is always already sorted by Seat — never re-sorted, never a Dictionary.
    public IReadOnlyList<PlayerState> Players => _players;

    public ImmutableArray<RegionState> Regions { get; }

    public PendingActivity? Pending { get; internal set; }

    public GameOutcome? Outcome { get; internal set; }

    public ActivityToken NextActivityToken { get; internal set; }

    public RegionState RegionOf(RegionId id) => _regionsById[id];

    public bool IsBase(RegionId id)
    {
        var region = RegionOf(id);
        if (region.OwnerId is not { } ownerId)
        {
            return false;
        }

        var owner = _players.FirstOrDefault(p => p.Id == ownerId);
        return owner is not null && owner.BaseRegion == id;
    }

    // Derived, never stored — same rationale as IsBase: 1000 while the player still holds their own
    // base, plus the map value of every other region they own.
    public int ScoreOf(PlayerId playerId)
    {
        var player = _players.FirstOrDefault(p => p.Id == playerId);
        if (player is null)
        {
            return 0;
        }

        var score = 0;
        foreach (var region in Regions)
        {
            if (region.OwnerId != playerId)
            {
                continue;
            }

            if (player.BaseRegion == region.Id)
            {
                score += 1000;
            }
            else
            {
                score += Map.Regions.First(r => r.Id == region.Id).Value;
            }
        }

        return score;
    }

    internal PlayerState AddPlayer(PlayerId id)
    {
        var player = new PlayerState { Id = id, Seat = _nextSeat++ };
        _players.Add(player);
        return player;
    }

    internal bool RemovePlayer(PlayerId id)
    {
        var index = _players.FindIndex(p => p.Id == id);
        if (index < 0)
        {
            return false;
        }

        _players.RemoveAt(index);
        return true;
    }

    internal ActivityToken IssueActivityToken()
    {
        var token = NextActivityToken;
        NextActivityToken = token.Next();
        return token;
    }

    public string Fingerprint()
    {
        var builder = new StringBuilder();
        builder.Append(Phase).Append('|');

        foreach (var player in _players)
        {
            builder.Append(player.Id).Append(':').Append(player.Seat).Append(':')
                .Append(player.BaseRegion).Append(':').Append(player.Eliminated).Append(';');
        }

        foreach (var region in Regions)
        {
            builder.Append(region.Id).Append(':').Append(region.OwnerId).Append(';');
        }

        builder.Append(Pending?.GetType().Name).Append('|').Append(NextActivityToken);
        return builder.ToString();
    }
}
