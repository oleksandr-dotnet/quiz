using System.Text.RegularExpressions;

namespace Triviador.Application.Accounts;

/// Player-visible handles - kept short and printable so they read well in a seat list, and
/// restricted to a character set that can't be mistaken for markup or break layout.
public static partial class UsernameRules
{
    private const int MinLength = 3;
    private const int MaxLength = 20;

    [GeneratedRegex("^[A-Za-z0-9_]+$")]
    private static partial Regex AllowedCharacters();

    public static bool IsValidFormat(string username) =>
        username.Length is >= MinLength and <= MaxLength && AllowedCharacters().IsMatch(username);
}

/// Backs the first-login username/avatar setup step (`player-accounts`'s "must set a unique
/// username and an avatar before playing" requirement). Format/set-membership checks happen here,
/// before ever calling into the repository - the repository only needs to guard the race on
/// uniqueness (see design.md Decision 9).
public sealed class AccountSetupService(IUserAccountRepository accounts)
{
    public async Task<UsernameSetResult> TrySetUsernameAsync(Guid userId, string username, CancellationToken ct = default)
    {
        var trimmed = username.Trim();
        if (!UsernameRules.IsValidFormat(trimmed))
        {
            return UsernameSetResult.Invalid;
        }

        return await accounts.TrySetUsernameAsync(userId, trimmed, ct);
    }

    public async Task<AccountProfileDto?> SetAvatarAsync(Guid userId, string avatarId, CancellationToken ct = default)
    {
        if (!AvailableAvatars.IsValid(avatarId))
        {
            return null;
        }

        return await accounts.SetAvatarAsync(userId, avatarId, ct);
    }
}
