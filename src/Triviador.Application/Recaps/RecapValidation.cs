namespace Triviador.Application.Recaps;

public readonly record struct RecapValidationResult(bool IsValid, string? Error)
{
    public static readonly RecapValidationResult Ok = new(true, null);

    public static RecapValidationResult Invalid(string error) => new(false, error);
}

/// Structural validation of a client-built recap payload before it's persisted - see design.md
/// Decision 1: the server trusts the client's bookkeeping of a *finished* game's own outcome (which
/// every viewer already legitimately saw), but still rejects a payload that isn't internally
/// consistent or that could corrupt storage/the SVG summary-image renderer. This never re-derives
/// gameplay truth from server-side state.
public static class RecapValidation
{
    private const int MaxPlayers = 8;
    private const int MaxRegions = 64;
    private const int MaxHighlights = 200;
    private const int MaxRoundsPlayed = 1000;
    private const int MaxScore = 1_000_000;
    private const int MaxStreak = 10_000;
    private const int MaxRoomCodeLength = 16;
    private const int MaxDisplayNameLength = 64;
    private const int MaxAvatarIdLength = 32;
    private const int MaxRegionIdLength = 64;
    private const int MaxViewBoxLength = 128;
    private const int MaxCategoryLength = 64;

    public static RecapValidationResult Validate(RecapPayloadDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.RoomCode) || dto.RoomCode.Length > MaxRoomCodeLength)
        {
            return RecapValidationResult.Invalid("InvalidRoomCode");
        }
        if (dto.RoundsPlayed < 0 || dto.RoundsPlayed > MaxRoundsPlayed)
        {
            return RecapValidationResult.Invalid("InvalidRoundsPlayed");
        }
        if (string.IsNullOrEmpty(dto.MapViewBox) || dto.MapViewBox.Length > MaxViewBoxLength)
        {
            return RecapValidationResult.Invalid("InvalidMapViewBox");
        }
        if (dto.Players.Count is < 1 or > MaxPlayers)
        {
            return RecapValidationResult.Invalid("InvalidPlayerCount");
        }

        var playerIds = new HashSet<Guid>();
        foreach (var p in dto.Players)
        {
            if (!playerIds.Add(p.PlayerId))
            {
                return RecapValidationResult.Invalid("DuplicatePlayerId");
            }
            if (string.IsNullOrWhiteSpace(p.DisplayName) || p.DisplayName.Length > MaxDisplayNameLength)
            {
                return RecapValidationResult.Invalid("InvalidDisplayName");
            }
            if (p.AvatarId is { Length: > MaxAvatarIdLength })
            {
                return RecapValidationResult.Invalid("InvalidAvatarId");
            }
            // Score can legitimately go negative - a base-assault loss subtracts GameRules.
            // BaseAssaultScoreBonus from the loser (see BaseAssaultScoreAdjusted) - so only an
            // implausibly large magnitude in either direction is rejected, not a negative value.
            if (p.FinalScore < -MaxScore || p.FinalScore > MaxScore)
            {
                return RecapValidationResult.Invalid("InvalidFinalScore");
            }
            if (p.TerritoriesHeld < 0 || p.TerritoriesHeld > MaxRegions)
            {
                return RecapValidationResult.Invalid("InvalidTerritoriesHeld");
            }
            if (p.LongestStreak < 0 || p.LongestStreak > MaxStreak)
            {
                return RecapValidationResult.Invalid("InvalidLongestStreak");
            }
        }

        foreach (var winnerId in dto.WinnerPlayerIds)
        {
            if (!playerIds.Contains(winnerId))
            {
                return RecapValidationResult.Invalid("UnknownWinnerPlayerId");
            }
        }

        if (dto.RegionOwnership.Count > MaxRegions)
        {
            return RecapValidationResult.Invalid("TooManyRegions");
        }
        foreach (var region in dto.RegionOwnership)
        {
            if (string.IsNullOrWhiteSpace(region.RegionId) || region.RegionId.Length > MaxRegionIdLength)
            {
                return RecapValidationResult.Invalid("InvalidRegionId");
            }
            if (region.OwnerPlayerId is { } ownerId && !playerIds.Contains(ownerId))
            {
                return RecapValidationResult.Invalid("UnknownRegionOwner");
            }
        }

        if (dto.Highlights.Count > MaxHighlights)
        {
            return RecapValidationResult.Invalid("TooManyHighlights");
        }
        foreach (var h in dto.Highlights)
        {
            if (h.AttackerPlayerId is { } attackerId && !playerIds.Contains(attackerId))
            {
                return RecapValidationResult.Invalid("UnknownHighlightPlayerId");
            }
            if (h.DefenderPlayerId is { } defenderId && !playerIds.Contains(defenderId))
            {
                return RecapValidationResult.Invalid("UnknownHighlightPlayerId");
            }
            if (h.WinnerPlayerIds is { } winners && winners.Any(id => !playerIds.Contains(id)))
            {
                return RecapValidationResult.Invalid("UnknownHighlightPlayerId");
            }
            if (h.BaseRegionId is { Length: > MaxRegionIdLength })
            {
                return RecapValidationResult.Invalid("InvalidRegionId");
            }
            if (h.Categories is { } categories && categories.Any(c => string.IsNullOrWhiteSpace(c) || c.Length > MaxCategoryLength))
            {
                return RecapValidationResult.Invalid("InvalidCategory");
            }
        }

        return RecapValidationResult.Ok;
    }
}
