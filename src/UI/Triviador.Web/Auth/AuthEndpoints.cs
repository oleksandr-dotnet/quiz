using System.Security.Claims;
using Triviador.Application.Accounts;

namespace Triviador.Web.Auth;

public sealed record GoogleSignInRequestDto(string IdToken);

public sealed record SetUsernameRequestDto(string Username);

public sealed record SetAvatarRequestDto(string AvatarId);

public sealed record AuthResponseDto(string AccessToken, DateTimeOffset AccessTokenExpiresAtUtc, AccountProfileDto Profile);

/// `/api/auth/*` - plain HTTP endpoints (not SignalR hub methods), since sign-in/refresh/logout are
/// independent of any room/game session. See design.md Decisions 4/5 for the token model these
/// implement.
public static class AuthEndpoints
{
    private const string RefreshCookieName = "trv_rt";

    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");
        var logger = app.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Triviador.Web.Auth.AuthEndpoints");

        group.MapPost("/google", async (GoogleSignInRequestDto body, GoogleSignInService signIn, HttpContext http) =>
        {
            var result = await signIn.SignInAsync(body.IdToken, http.RequestAborted);
            if (result.Status != GoogleSignInStatus.Ok || result.Profile is null || result.AccessToken is null || result.RefreshToken is null)
            {
                // GoogleSignInService/GoogleIdTokenVerifier already logged the specific reason -
                // this is just the HTTP-layer outcome so it's visible without cross-referencing.
                logger.LogWarning("POST /api/auth/google -> 401 ({Status})", result.Status);
                return Results.Unauthorized();
            }

            SetRefreshCookie(http, result.RefreshToken);
            return Results.Ok(new AuthResponseDto(result.AccessToken.Value, result.AccessToken.ExpiresAtUtc, result.Profile));
        });

        group.MapPost("/refresh", async (IRefreshTokenStore refreshTokens, IUserAccountRepository accounts,
            ITokenIssuer tokenIssuer, HttpContext http) =>
        {
            // CSRF guard: a SameSite=Strict cookie already blocks cross-site sends, but requiring
            // this header too closes the gap for browsers/proxies with looser SameSite handling -
            // see design.md Decision 5. A cross-site form/navigation cannot set a custom header.
            if (!http.Request.Headers.ContainsKey("X-Requested-With"))
            {
                logger.LogDebug("POST /api/auth/refresh -> 401 (missing X-Requested-With header)");
                return Results.Unauthorized();
            }

            var rawToken = http.Request.Cookies[RefreshCookieName];
            if (rawToken is null)
            {
                // Expected for every first-time/anonymous visitor - no refresh cookie has ever
                // been issued to them. Debug, not Warning, to avoid drowning real failures out.
                logger.LogDebug("POST /api/auth/refresh -> 401 (no refresh cookie)");
                return Results.Unauthorized();
            }

            var redeemed = await refreshTokens.RedeemAndRotateAsync(rawToken, http.RequestAborted);
            if (redeemed.Status != RefreshTokenRedeemStatus.Success || redeemed.UserId is null || redeemed.Rotated is null)
            {
                logger.LogWarning("POST /api/auth/refresh -> 401 ({Status})", redeemed.Status);
                http.Response.Cookies.Delete(RefreshCookieName, RefreshCookiePath());
                return Results.Unauthorized();
            }

            var profile = await accounts.FindByIdAsync(redeemed.UserId.Value, http.RequestAborted);
            if (profile is null)
            {
                logger.LogWarning("POST /api/auth/refresh -> 401 (refresh token valid but user {UserId} not found)", redeemed.UserId);
                return Results.Unauthorized();
            }

            SetRefreshCookie(http, redeemed.Rotated);
            var accessToken = tokenIssuer.IssueAccessToken(profile);
            return Results.Ok(new AuthResponseDto(accessToken.Value, accessToken.ExpiresAtUtc, profile));
        });

        group.MapPost("/logout", async (IRefreshTokenStore refreshTokens, HttpContext http) =>
        {
            var rawToken = http.Request.Cookies[RefreshCookieName];
            if (rawToken is not null)
            {
                await refreshTokens.RevokeAsync(rawToken, http.RequestAborted);
            }
            http.Response.Cookies.Delete(RefreshCookieName, RefreshCookiePath());
            return Results.Ok();
        });

        group.MapGet("/me", (ClaimsPrincipal user, IUserAccountRepository accounts, CancellationToken ct) =>
                ResolveOwnProfileAsync(user, accounts, ct))
            .RequireAuthorization();

        group.MapPost("/username", async (SetUsernameRequestDto body, ClaimsPrincipal user,
            AccountSetupService setup, IUserAccountRepository accounts, CancellationToken ct) =>
        {
            var userId = RequireUserId(user);
            var result = await setup.TrySetUsernameAsync(userId, body.Username, ct);
            return result switch
            {
                UsernameSetResult.Ok => Results.Ok(await accounts.FindByIdAsync(userId, ct)),
                UsernameSetResult.Invalid => Results.BadRequest(new { error = "InvalidUsername" }),
                UsernameSetResult.Taken => Results.Conflict(new { error = "UsernameTaken" }),
                _ => Results.Problem(),
            };
        }).RequireAuthorization();

        group.MapPost("/avatar", async (SetAvatarRequestDto body, ClaimsPrincipal user,
            AccountSetupService setup, CancellationToken ct) =>
        {
            var userId = RequireUserId(user);
            var profile = await setup.SetAvatarAsync(userId, body.AvatarId, ct);
            return profile is null ? Results.BadRequest(new { error = "InvalidAvatar" }) : Results.Ok(profile);
        }).RequireAuthorization();
    }

    private static async Task<IResult> ResolveOwnProfileAsync(ClaimsPrincipal user, IUserAccountRepository accounts, CancellationToken ct)
    {
        var profile = await accounts.FindByIdAsync(RequireUserId(user), ct);
        return profile is null ? Results.NotFound() : Results.Ok(profile);
    }

    private static Guid RequireUserId(ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirst("sub")!.Value);

    private static CookieOptions RefreshCookiePath() => new() { Path = "/api/auth" };

    private static void SetRefreshCookie(HttpContext http, RefreshTokenIssued issued)
    {
        http.Response.Cookies.Append(RefreshCookieName, issued.RawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/api/auth",
            Expires = issued.ExpiresAtUtc,
        });
    }
}
