using Triviador.Domain.State;

namespace Triviador.Application.Recaps;

/// One player's final line in a recap - built client-side from data the same player already saw
/// live via `PlayerViewDto`/`GameViewDto` snapshots (see design.md's "client builds the payload"
/// decision). `AvatarId` stays the opaque id already used everywhere else on the wire - never a
/// resolved glyph - so the avatar art can change later without touching stored recaps.
public sealed record RecapPlayerDto(
    Guid PlayerId,
    string DisplayName,
    string? AvatarId,
    bool IsBot,
    int FinalScore,
    int TerritoriesHeld,
    int LongestStreak,
    bool Eliminated);

public sealed record RecapRegionOwnershipDto(string RegionId, Guid? OwnerPlayerId);

public enum RecapHighlightKindDto
{
    BaseAssault,
    GoldenQuestion,
    CategoryBansResolved,
}

/// A tagged union flattened onto one record (matches how PendingActivity-adjacent DTOs elsewhere in
/// this codebase are already projected) - only the fields relevant to `Kind` are populated.
public sealed record RecapHighlightDto(
    RecapHighlightKindDto Kind,
    Guid? AttackerPlayerId = null,
    Guid? DefenderPlayerId = null,
    string? BaseRegionId = null,
    bool? AttackerWon = null,
    IReadOnlyList<Guid>? WinnerPlayerIds = null,
    IReadOnlyList<string>? Categories = null);

/// The full recap of one finished match, built client-side and posted to the server only when a
/// player explicitly shares it (see design.md Decision 1) - never reconstructed from server-side
/// game state.
public sealed record RecapPayloadDto(
    string RoomCode,
    DateTimeOffset FinishedAtUtc,
    int RoundsPlayed,
    Language Language,
    string MapViewBox,
    IReadOnlyList<Guid> WinnerPlayerIds,
    IReadOnlyList<RecapPlayerDto> Players,
    IReadOnlyList<RecapRegionOwnershipDto> RegionOwnership,
    IReadOnlyList<RecapHighlightDto> Highlights);

/// The row shape returned for a share request and for listing - `Id` is also the public share id
/// used in `/recap/{id}` and `/api/recaps/{id}`.
public sealed record RecapSummaryDto(
    Guid Id,
    string RoomCode,
    DateTimeOffset FinishedAtUtc,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyList<string> WinnerDisplayNames);

public sealed record RecapDto(Guid Id, DateTimeOffset CreatedAtUtc, RecapPayloadDto Payload);
