using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Triviador.Application.Accounts;

namespace Triviador.Web.Auth;

/// The `ITokenIssuer` implementation - deliberately in `Triviador.Web`, not `Triviador.Application`,
/// so the signing key/config stays a host concern (design.md Decision 7).
public sealed class JwtTokenIssuer(IOptions<JwtOptions> options) : ITokenIssuer
{
    public AccessToken IssueAccessToken(AccountProfileDto profile)
    {
        var opts = options.Value;
        var now = DateTimeOffset.UtcNow;
        var expires = now + opts.AccessTokenLifetime;

        var claims = new[]
        {
            new Claim("sub", profile.UserId.ToString()),
            new Claim("username", profile.Username ?? string.Empty),
            new Claim("avatar", profile.AvatarId ?? string.Empty),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(opts.SigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: opts.Issuer,
            audience: opts.Audience,
            claims: claims,
            notBefore: now.UtcDateTime,
            expires: expires.UtcDateTime,
            signingCredentials: credentials);

        return new AccessToken(new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
