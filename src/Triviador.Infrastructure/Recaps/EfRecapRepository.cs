using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Triviador.Application.Recaps;
using Triviador.Infrastructure.Accounts;
using Triviador.Infrastructure.Recaps.Entities;

namespace Triviador.Infrastructure.Recaps;

public sealed class EfRecapRepository(TriviadorDbContext db) : IRecapRepository
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        Converters = { new JsonStringEnumConverter() },
    };

    public async Task<Guid> CreateOrGetAsync(
        string fingerprint, RecapPayloadDto payload, Guid? sharedByUserId, int retentionDays, CancellationToken ct = default)
    {
        var existingId = await db.GameRecaps.AsNoTracking()
            .Where(r => r.Fingerprint == fingerprint)
            .Select(r => (Guid?)r.Id)
            .FirstOrDefaultAsync(ct);
        if (existingId is { } id)
        {
            return id;
        }

        var now = DateTimeOffset.UtcNow;
        var recap = new GameRecap
        {
            Id = Guid.NewGuid(),
            Fingerprint = fingerprint,
            RoomCode = payload.RoomCode,
            CreatedAtUtc = now,
            ExpiresAtUtc = now.AddDays(retentionDays),
            SharedByUserId = sharedByUserId,
            PayloadJson = JsonSerializer.Serialize(payload, JsonOptions),
        };
        db.GameRecaps.Add(recap);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Two sharers racing to create the same fingerprint - the unique index is the real
            // guard (same pattern as EfUserAccountRepository.TrySetUsernameAsync); the loser here
            // just re-reads the winner's row.
            var winnerId = await db.GameRecaps.AsNoTracking()
                .Where(r => r.Fingerprint == fingerprint)
                .Select(r => r.Id)
                .FirstAsync(ct);
            return winnerId;
        }

        return recap.Id;
    }

    public async Task<RecapDto?> FindAsync(Guid id, CancellationToken ct = default)
    {
        var row = await db.GameRecaps.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (row is null || row.ExpiresAtUtc <= DateTimeOffset.UtcNow)
        {
            return null;
        }

        var payload = JsonSerializer.Deserialize<RecapPayloadDto>(row.PayloadJson, JsonOptions)!;
        return new RecapDto(row.Id, row.CreatedAtUtc, payload);
    }

    public async Task<RecapSummaryDto?> FindSummaryAsync(Guid id, CancellationToken ct = default)
    {
        var recap = await FindAsync(id, ct);
        return recap is null ? null : ToSummary(recap);
    }

    public async Task<IReadOnlyList<RecapSummaryDto>> ListForUserAsync(Guid userId, CancellationToken ct = default)
    {
        var rows = await db.GameRecaps.AsNoTracking()
            .Where(r => r.SharedByUserId == userId && r.ExpiresAtUtc > DateTimeOffset.UtcNow)
            .OrderByDescending(r => r.CreatedAtUtc)
            .ToListAsync(ct);

        return rows
            .Select(row => ToSummary(new RecapDto(row.Id, row.CreatedAtUtc, JsonSerializer.Deserialize<RecapPayloadDto>(row.PayloadJson, JsonOptions)!)))
            .ToArray();
    }

    public async Task<int> DeleteExpiredAsync(DateTimeOffset now, CancellationToken ct = default)
    {
        return await db.GameRecaps.Where(r => r.ExpiresAtUtc <= now).ExecuteDeleteAsync(ct);
    }

    private static RecapSummaryDto ToSummary(RecapDto recap)
    {
        var winnerNames = recap.Payload.Players
            .Where(p => recap.Payload.WinnerPlayerIds.Contains(p.PlayerId))
            .Select(p => p.DisplayName)
            .ToArray();
        return new RecapSummaryDto(recap.Id, recap.Payload.RoomCode, recap.Payload.FinishedAtUtc, recap.CreatedAtUtc, winnerNames);
    }
}
