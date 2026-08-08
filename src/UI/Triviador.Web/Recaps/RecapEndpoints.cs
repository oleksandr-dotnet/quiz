using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Triviador.Application.Recaps;
using Triviador.Infrastructure.Recaps;

namespace Triviador.Web.Recaps;

public sealed record ShareRecapRequestDto(RecapPayloadDto Payload);

public sealed record ShareRecapResponseDto(Guid Id);

/// `/api/recaps/*` plus the crawler-facing `/recap/{id}` shell - see design.md. Posting a recap
/// never requires authorization (anonymous sharing stays possible, matching player-accounts'
/// "anonymous play remains fully available" principle); it just attaches SharedByUserId when a
/// valid bearer token happens to be present.
public static class RecapEndpoints
{
    public static void MapRecapEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api/recaps");
        var logger = app.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Triviador.Web.Recaps.RecapEndpoints");

        api.MapPost("/", async (ShareRecapRequestDto body, IRecapRepository recaps, IOptions<RecapOptions> options, ClaimsPrincipal user) =>
        {
            var validation = RecapValidation.Validate(body.Payload);
            if (!validation.IsValid)
            {
                logger.LogWarning("POST /api/recaps -> 400 ({Error})", validation.Error);
                return Results.BadRequest(new { error = validation.Error });
            }

            var fingerprint = RecapFingerprint.Compute(body.Payload);
            var sharedByUserId = user.Identity?.IsAuthenticated == true ? TryGetUserId(user) : null;
            var id = await recaps.CreateOrGetAsync(fingerprint, body.Payload, sharedByUserId, options.Value.RetentionDays);
            return Results.Ok(new ShareRecapResponseDto(id));
        });

        api.MapGet("/mine", async (IRecapRepository recaps, ClaimsPrincipal user, CancellationToken ct) =>
        {
            var userId = TryGetUserId(user);
            if (userId is null)
            {
                return Results.Unauthorized();
            }
            return Results.Ok(await recaps.ListForUserAsync(userId.Value, ct));
        }).RequireAuthorization();

        api.MapGet("/{id:guid}", async (Guid id, IRecapRepository recaps, CancellationToken ct) =>
        {
            var recap = await recaps.FindAsync(id, ct);
            return recap is null ? Results.NotFound() : Results.Ok(recap.Payload);
        });

        api.MapGet("/{id:guid}/image.svg", async (Guid id, IRecapRepository recaps, CancellationToken ct) =>
        {
            var recap = await recaps.FindAsync(id, ct);
            var svg = recap is null ? RecapImage.NotFoundSvg() : RecapImage.Render(recap.Payload);
            return Results.Text(svg, "image/svg+xml");
        });

        MapRecapShell(app);
    }

    // A real path route (not a `#/...` hash route - see design.md Decision 3), registered before
    // the SPA's own MapFallbackToFile("index.html") in Program.cs. Serves the exact same JS bundle
    // with og:* tags injected into <head>, so a browser gets an ordinary app load while a
    // link-preview crawler (which never executes JS or reads a hash fragment) sees the meta tags.
    private static void MapRecapShell(IEndpointRouteBuilder app)
    {
        app.MapGet("/recap/{id:guid}", async (Guid id, HttpContext http, IRecapRepository recaps, IWebHostEnvironment env, CancellationToken ct) =>
        {
            var indexPath = Path.Combine(env.WebRootPath ?? string.Empty, "index.html");
            if (!File.Exists(indexPath))
            {
                // No built client in this environment (e.g. `dotnet watch` against the Vite dev
                // server on :5173) - nothing to inject into. Not the production path.
                return Results.NotFound();
            }

            var shell = await File.ReadAllTextAsync(indexPath, ct);
            var summary = await recaps.FindSummaryAsync(id, ct);
            if (summary is null)
            {
                return Results.Content(shell, "text/html");
            }

            var baseUrl = $"{http.Request.Scheme}://{http.Request.Host}";
            var title = summary.WinnerDisplayNames.Count > 0
                ? $"{string.Join(" & ", summary.WinnerDisplayNames)} won a game of Triviador!"
                : "A game of Triviador";
            var description = $"Room {summary.RoomCode} · played {summary.FinishedAtUtc:yyyy-MM-dd}";
            var imageUrl = $"{baseUrl}/api/recaps/{id}/image.svg";
            var pageUrl = $"{baseUrl}/recap/{id}";

            var meta = new StringBuilder()
                .Append($"<meta property=\"og:type\" content=\"website\" />")
                .Append($"<meta property=\"og:title\" content=\"{Encode(title)}\" />")
                .Append($"<meta property=\"og:description\" content=\"{Encode(description)}\" />")
                .Append($"<meta property=\"og:image\" content=\"{Encode(imageUrl)}\" />")
                .Append($"<meta property=\"og:url\" content=\"{Encode(pageUrl)}\" />")
                .Append($"<meta name=\"twitter:card\" content=\"summary_large_image\" />")
                .ToString();

            var withMeta = shell.Replace("<title>Triviador</title>", $"<title>Triviador</title>\n{meta}");
            return Results.Content(withMeta, "text/html");
        });
    }

    private static string Encode(string value) => System.Net.WebUtility.HtmlEncode(value);

    private static Guid? TryGetUserId(ClaimsPrincipal user)
    {
        var raw = user.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
