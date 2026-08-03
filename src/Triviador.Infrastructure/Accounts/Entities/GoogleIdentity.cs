namespace Triviador.Infrastructure.Accounts.Entities;

/// Links one Google account to one `User`, keyed on Google's stable `sub` claim - never on email,
/// which Google itself documents as changeable/reusable. See design.md Decision 3.
public sealed class GoogleIdentity
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string GoogleSubject { get; set; } = string.Empty;

    /// Latest known value at sign-in time - display/debug only, never the link key.
    public string Email { get; set; } = string.Empty;

    public DateTimeOffset LinkedAtUtc { get; set; }
}
