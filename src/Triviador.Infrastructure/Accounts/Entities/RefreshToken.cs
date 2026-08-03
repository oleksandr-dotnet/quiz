namespace Triviador.Infrastructure.Accounts.Entities;

/// Only ever stores a SHA-256 hash of the raw token - see design.md Decision 5. `FamilyId` is
/// shared by a token and everything it's rotated into, so a single reuse-detection revocation can
/// invalidate the whole chain at once.
public sealed class RefreshToken
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public byte[] TokenHash { get; set; } = [];

    public Guid FamilyId { get; set; }

    public DateTimeOffset ExpiresAtUtc { get; set; }

    public DateTimeOffset? RevokedAtUtc { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
}
