namespace Triviador.Application.Accounts;

public sealed record AccessToken(string Value, DateTimeOffset ExpiresAtUtc);

/// Port implemented in `Triviador.Web` - see design.md Decision 7: the JWT signing key/config is a
/// host concern, deliberately kept out of `Triviador.Application`. This interface is the only thing
/// Application ever sees of it.
public interface ITokenIssuer
{
    AccessToken IssueAccessToken(AccountProfileDto profile);
}
