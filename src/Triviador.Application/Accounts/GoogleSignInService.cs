using Microsoft.Extensions.Logging;

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
    ITokenIssuer tokenIssuer,
    ILogger<GoogleSignInService> logger)
{
    public async Task<GoogleSignInResult> SignInAsync(string googleIdToken, CancellationToken ct = default)
    {
        var claims = await verifier.VerifyAsync(googleIdToken, ct);
        if (claims is null)
        {
            // The verifier already logged the specific rejection reason (bad audience, expired,
            // etc.) - this just marks that a sign-in attempt reached the service and failed.
            logger.LogWarning("Google sign-in rejected: token failed verification");
            return GoogleSignInResult.InvalidToken;
        }

        var existing = await accounts.FindByGoogleSubjectAsync(claims.Subject, ct);
        var profile = existing ?? await accounts.CreateFromGoogleAsync(claims.Subject, claims.Email, ct);
        logger.LogInformation(
            existing is null
                ? "Google sign-in created a new account {UserId} for Google subject {GoogleSubject}"
                : "Google sign-in resolved existing account {UserId} for Google subject {GoogleSubject}",
            profile.UserId, claims.Subject);

        var accessToken = tokenIssuer.IssueAccessToken(profile);
        var refreshToken = await refreshTokens.IssueAsync(profile.UserId, ct);

        return new GoogleSignInResult(GoogleSignInStatus.Ok, profile, accessToken, refreshToken);
    }
}
