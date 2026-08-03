namespace Triviador.Application.Accounts;

public enum GoogleSignInStatus
{
    Ok,
    InvalidToken,
}

public sealed record GoogleSignInResult(
    GoogleSignInStatus Status,
    AccountProfileDto? Profile = null,
    AccessToken? AccessToken = null,
    RefreshTokenIssued? RefreshToken = null)
{
    public static readonly GoogleSignInResult InvalidToken = new(GoogleSignInStatus.InvalidToken);
}

/// Orchestrates a Google sign-in end to end: verify the token, resolve-or-create the account,
/// issue a fresh access/refresh token pair. This is the Application-layer use case behind
/// `POST /api/auth/google` - `Triviador.Web` never talks to the verifier or repository directly.
public sealed class GoogleSignInService(
    IGoogleIdTokenVerifier verifier,
    IUserAccountRepository accounts,
    IRefreshTokenStore refreshTokens,
    ITokenIssuer tokenIssuer)
{
    public async Task<GoogleSignInResult> SignInAsync(string googleIdToken, CancellationToken ct = default)
    {
        var claims = await verifier.VerifyAsync(googleIdToken, ct);
        if (claims is null)
        {
            return GoogleSignInResult.InvalidToken;
        }

        var profile = await accounts.FindByGoogleSubjectAsync(claims.Subject, ct)
            ?? await accounts.CreateFromGoogleAsync(claims.Subject, claims.Email, ct);

        var accessToken = tokenIssuer.IssueAccessToken(profile);
        var refreshToken = await refreshTokens.IssueAsync(profile.UserId, ct);

        return new GoogleSignInResult(GoogleSignInStatus.Ok, profile, accessToken, refreshToken);
    }
}
