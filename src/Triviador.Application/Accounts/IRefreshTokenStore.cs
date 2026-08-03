namespace Triviador.Application.Accounts;

public sealed record RefreshTokenIssued(string RawToken, DateTimeOffset ExpiresAtUtc);

public enum RefreshTokenRedeemStatus
{
    Success,
    NotFoundOrExpired,

    /// The presented token had already been rotated past - see design.md Decision 5. The whole
    /// family is revoked as a side effect of returning this status; the caller forces a fresh sign-in.
    ReuseDetected,
}

public sealed record RefreshTokenRedeemResult(
    RefreshTokenRedeemStatus Status,
    Guid? UserId = null,
    RefreshTokenIssued? Rotated = null)
{
    public static readonly RefreshTokenRedeemResult NotFoundOrExpired = new(RefreshTokenRedeemStatus.NotFoundOrExpired);
    public static readonly RefreshTokenRedeemResult ReuseDetected = new(RefreshTokenRedeemStatus.ReuseDetected);

    public static RefreshTokenRedeemResult Success(Guid userId, RefreshTokenIssued rotated) =>
        new(RefreshTokenRedeemStatus.Success, userId, rotated);
}

/// Port implemented by `Triviador.Infrastructure`. Only ever sees/stores a token's hash - see
/// design.md Decision 5. `Triviador.Application` never learns the signing/hashing details.
public interface IRefreshTokenStore
{
    Task<RefreshTokenIssued> IssueAsync(Guid userId, CancellationToken ct = default);

    /// Validates the presented raw token, revokes it, and issues a new one in the same rotation
    /// family. A stale (already-revoked) token triggers reuse detection instead of silently failing.
    Task<RefreshTokenRedeemResult> RedeemAndRotateAsync(string rawToken, CancellationToken ct = default);

    /// Revokes every token in the family the presented raw token belongs to. A no-op if the token
    /// doesn't resolve to anything (already revoked/unknown) - logout is always "safe to call".
    Task RevokeAsync(string rawToken, CancellationToken ct = default);
}
