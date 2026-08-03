namespace Triviador.Web.Auth;

public sealed class JwtOptions
{
    /// HMAC-SHA256 signing key. Must come from configuration/secret (user-secrets locally,
    /// environment/secret manager in production) - never hardcoded, never committed.
    public string SigningKey { get; set; } = string.Empty;

    public string Issuer { get; set; } = "triviador";

    public string Audience { get; set; } = "triviador-client";

    /// Short-lived by design (design.md Decision 4) - a stolen access token's blast radius is
    /// bounded to this window; the refresh token is what's actually revocable.
    public TimeSpan AccessTokenLifetime { get; set; } = TimeSpan.FromMinutes(15);
}
