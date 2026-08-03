using Google.Apis.Auth;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Triviador.Application.Accounts;

namespace Triviador.Infrastructure.Accounts;

public sealed class GoogleAuthOptions
{
    /// The OAuth client id registered in Google Cloud Console for this app - checked against the
    /// verified token's `aud` claim. Public by design (client ids are not secrets); provisioning
    /// the Google Cloud Console project itself is an operational step outside this repo.
    public string ClientId { get; set; } = string.Empty;
}

/// Implements the Application-level port over `Google.Apis.Auth` - see design.md Decision 2:
/// verifies signature (against Google's published keys), issuer, audience, and expiry before ever
/// returning a claim. A failed verification of any kind returns null, never a partial result.
public sealed class GoogleIdTokenVerifier(IOptions<GoogleAuthOptions> options, ILogger<GoogleIdTokenVerifier> logger)
    : IGoogleIdTokenVerifier
{
    public async Task<GoogleIdentityClaims?> VerifyAsync(string idToken, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(options.Value.ClientId))
        {
            // Every token will fail audience validation below anyway, but that exception message
            // doesn't say *why* - this is the actual root cause worth surfacing.
            logger.LogWarning("Rejecting Google sign-in: GoogleAuth:ClientId is not configured on this server");
        }

        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [options.Value.ClientId],
            };
            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
            return new GoogleIdentityClaims(payload.Subject, payload.Email, payload.Name, payload.Picture);
        }
        catch (InvalidJwtException ex)
        {
            // Never log the token itself - only the validator's reason (audience/issuer/expiry
            // mismatch etc.), which is what actually helps diagnose a misconfigured client id.
            logger.LogWarning(ex, "Google ID token failed validation: {Reason}", ex.Message);
            return null;
        }
    }
}
