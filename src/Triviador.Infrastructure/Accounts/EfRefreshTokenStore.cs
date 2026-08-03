using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Triviador.Application.Accounts;
using Triviador.Infrastructure.Accounts.Entities;

namespace Triviador.Infrastructure.Accounts;

/// Implements the Application-level refresh-token port with rotation-with-reuse-detection - see
/// design.md Decision 5. Only ever persists a SHA-256 hash of the raw token; the raw value exists
/// only in the response to the caller and is never logged or stored.
public sealed class EfRefreshTokenStore(TriviadorDbContext db) : IRefreshTokenStore
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromDays(30);

    public async Task<RefreshTokenIssued> IssueAsync(Guid userId, CancellationToken ct = default)
    {
        var (raw, hash) = GenerateToken();
        var now = DateTimeOffset.UtcNow;
        var expiresAt = now + Lifetime;

        db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = hash,
            FamilyId = Guid.NewGuid(),
            ExpiresAtUtc = expiresAt,
            CreatedAtUtc = now,
        });
        await db.SaveChangesAsync(ct);

        return new RefreshTokenIssued(raw, expiresAt);
    }

    public async Task<RefreshTokenRedeemResult> RedeemAndRotateAsync(string rawToken, CancellationToken ct = default)
    {
        var hash = Hash(rawToken);
        var token = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is null || token.ExpiresAtUtc < DateTimeOffset.UtcNow)
        {
            return RefreshTokenRedeemResult.NotFoundOrExpired;
        }

        if (token.RevokedAtUtc is not null)
        {
            await RevokeFamilyAsync(token.FamilyId, ct);
            return RefreshTokenRedeemResult.ReuseDetected;
        }

        var now = DateTimeOffset.UtcNow;
        token.RevokedAtUtc = now;

        var (raw, newHash) = GenerateToken();
        var expiresAt = now + Lifetime;
        db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = token.UserId,
            TokenHash = newHash,
            FamilyId = token.FamilyId,
            ExpiresAtUtc = expiresAt,
            CreatedAtUtc = now,
        });
        await db.SaveChangesAsync(ct);

        return RefreshTokenRedeemResult.Success(token.UserId, new RefreshTokenIssued(raw, expiresAt));
    }

    public async Task RevokeAsync(string rawToken, CancellationToken ct = default)
    {
        var hash = Hash(rawToken);
        var token = await db.RefreshTokens.AsNoTracking().FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is null)
        {
            return;
        }

        await RevokeFamilyAsync(token.FamilyId, ct);
    }

    private async Task RevokeFamilyAsync(Guid familyId, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var family = await db.RefreshTokens
            .Where(t => t.FamilyId == familyId && t.RevokedAtUtc == null)
            .ToListAsync(ct);
        foreach (var t in family)
        {
            t.RevokedAtUtc = now;
        }
        await db.SaveChangesAsync(ct);
    }

    private static (string Raw, byte[] Hash) GenerateToken()
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        return (raw, Hash(raw));
    }

    private static byte[] Hash(string raw) => SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(raw));
}
