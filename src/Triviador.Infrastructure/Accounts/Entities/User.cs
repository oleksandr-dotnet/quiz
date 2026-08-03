namespace Triviador.Infrastructure.Accounts.Entities;

public sealed class User
{
    public Guid Id { get; set; }

    /// Player-chosen casing, shown as-is. Nullable until first-login setup completes.
    public string? Username { get; set; }

    /// Lower-invariant of Username - the actual unique-index target (design.md Decision 3/9).
    public string? UsernameNorm { get; set; }

    public string? AvatarId { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
}
