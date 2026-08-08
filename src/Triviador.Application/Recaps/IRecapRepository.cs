namespace Triviador.Application.Recaps;

/// Port implemented by `Triviador.Infrastructure` against `TriviadorDbContext`. Never exposes an EF
/// entity - only the DTOs in this folder.
public interface IRecapRepository
{
    /// Upsert-by-fingerprint (see design.md Decision 2): if a recap with this fingerprint already
    /// exists, returns its id unchanged (first-sharer's `sharedByUserId` sticks); otherwise creates
    /// a new row with `ExpiresAtUtc = now + retentionDays` and returns its new id.
    Task<Guid> CreateOrGetAsync(
        string fingerprint, RecapPayloadDto payload, Guid? sharedByUserId, int retentionDays, CancellationToken ct = default);

    Task<RecapDto?> FindAsync(Guid id, CancellationToken ct = default);

    /// Summary projection for the crawler-facing OG shell and the SVG image route - just enough to
    /// render meta tags, without handing full highlight/region detail to those routes.
    Task<RecapSummaryDto?> FindSummaryAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<RecapSummaryDto>> ListForUserAsync(Guid userId, CancellationToken ct = default);

    /// Returns the number of rows deleted, for RecapJanitor's own logging.
    Task<int> DeleteExpiredAsync(DateTimeOffset now, CancellationToken ct = default);
}
