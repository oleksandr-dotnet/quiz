namespace Triviador.Application.Accounts;

/// Claims read from an already-verified Google ID token - `Subject` (`sub`) is the only field ever
/// used as a lookup/link key; `Email` is display/debug only (see design.md Decision 3).
public sealed record GoogleIdentityClaims(string Subject, string Email, string? Name, string? Picture);

/// Port implemented by `Triviador.Infrastructure` via `Google.Apis.Auth`. A failed verification
/// (bad signature, wrong issuer/audience, expired) returns null - see design.md Decision 2. No
/// partial trust of any claim from a token that didn't fully verify.
public interface IGoogleIdTokenVerifier
{
    Task<GoogleIdentityClaims?> VerifyAsync(string idToken, CancellationToken ct = default);
}
