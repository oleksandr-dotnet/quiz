namespace Triviador.Application.Accounts;

public enum UsernameSetResult
{
    Ok,
    Invalid,
    Taken,
}

/// Port implemented by `Triviador.Infrastructure` against `TriviadorDbContext`. Never exposes an
/// EF entity or anything DB-shaped - only `AccountProfileDto` and plain results.
public interface IUserAccountRepository
{
    Task<AccountProfileDto?> FindByGoogleSubjectAsync(string googleSubject, CancellationToken ct = default);

    /// Creates a new account linked to this Google subject id. Caller (GoogleSignInService) must
    /// have already confirmed no account exists for this subject - this always creates.
    Task<AccountProfileDto> CreateFromGoogleAsync(string googleSubject, string email, CancellationToken ct = default);

    Task<AccountProfileDto?> FindByIdAsync(Guid userId, CancellationToken ct = default);

    /// Format validation (length/characters) is the caller's (AccountSetupService's) job; this is
    /// the uniqueness guard - see design.md Decision 9 for why the DB unique index is the real
    /// source of truth and this is a race-safe wrapper around it.
    Task<UsernameSetResult> TrySetUsernameAsync(Guid userId, string username, CancellationToken ct = default);

    /// Caller (AccountSetupService) must have already validated avatarId against AvailableAvatars.
    Task<AccountProfileDto> SetAvatarAsync(Guid userId, string avatarId, CancellationToken ct = default);
}
