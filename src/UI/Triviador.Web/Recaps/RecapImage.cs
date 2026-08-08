using System.Net;
using System.Text;
using Triviador.Application.Recaps;

namespace Triviador.Web.Recaps;

/// Renders the `og:image` for a shared recap as a plain SVG, generated fresh from the stored
/// payload on every request rather than persisted (design.md Decision 4) - never drifts from the
/// data it summarizes, and needs no image storage/blob column. Deliberately a small legend (winner
/// banner + per-player score rows + a region-ownership tally), not a literal redraw of GameMap's SVG.
public static class RecapImage
{
    // Mirrors src/Triviador.Client/src/lib/seats.ts SEAT_COLORS - a concrete hex palette, not a
    // shared source, per this repo's existing "hand-written mirror" convention for cross-boundary
    // constants (see CLAUDE.md's note on contracts.ts).
    private static readonly string[] SeatColors = ["#a8332c", "#2f4a7a", "#3f6b43", "#8c621a"];

    // Mirrors src/Triviador.Client/src/lib/avatars.ts's EMOJI map - see design.md Decision 5: this
    // is the one server-side seam that would need updating (alongside Avatar.tsx) if the avatar set
    // ever becomes uploaded photos instead of a bundled emoji glyph.
    private static readonly Dictionary<string, string> AvatarGlyphs = new()
    {
        ["fox"] = "🦊",
        ["owl"] = "🦉",
        ["wolf"] = "🐺",
        ["bear"] = "🐻",
        ["lion"] = "🦁",
        ["eagle"] = "🦅",
        ["otter"] = "🦦",
        ["raven"] = "🐦‍⬛",
        ["hawk"] = "🦅",
        ["stag"] = "🦌",
        ["boar"] = "🐗",
        ["lynx"] = "🐈",
    };

    private const int Width = 1200;
    private const int Height = 630;

    public static string Render(RecapPayloadDto payload)
    {
        var winners = payload.WinnerPlayerIds.ToHashSet();
        var standings = payload.Players.OrderByDescending(p => p.FinalScore).ToArray();

        var sb = new StringBuilder();
        sb.Append($"""<svg xmlns="http://www.w3.org/2000/svg" width="{Width}" height="{Height}" viewBox="0 0 {Width} {Height}">""");
        sb.Append($"""<rect width="{Width}" height="{Height}" fill="#f4ecd8" />""");
        sb.Append($"""<text x="60" y="90" font-family="Georgia,serif" font-size="48" font-weight="700" fill="#2b2318">Triviador</text>""");

        var headline = winners.Count == 0
            ? "No winner"
            : string.Join(" &amp; ", standings.Where(p => winners.Contains(p.PlayerId)).Select(p => Encode(p.DisplayName))) + " won!";
        sb.Append($"""<text x="60" y="150" font-family="Georgia,serif" font-size="32" fill="#8f2b22">{headline}</text>""");

        var y = 220;
        foreach (var p in standings.Take(4))
        {
            var seat = Array.IndexOf(standings, p) % SeatColors.Length;
            var color = SeatColors[seat];
            var glyph = p.AvatarId is { } avatarId && AvatarGlyphs.TryGetValue(avatarId, out var g) ? g : "";
            sb.Append($"""<rect x="60" y="{y - 28}" width="24" height="24" rx="4" fill="{color}" />""");
            sb.Append($"""<text x="100" y="{y - 8}" font-family="Georgia,serif" font-size="28" fill="#2b2318">{glyph} {Encode(p.DisplayName)}</text>""");
            sb.Append($"""<text x="{Width - 60}" y="{y - 8}" font-family="Georgia,serif" font-size="28" fill="#463823" text-anchor="end">{p.FinalScore}</text>""");
            y += 60;
        }

        sb.Append($"""<text x="60" y="{Height - 40}" font-family="Georgia,serif" font-size="20" fill="#6b5a3a">Room {Encode(payload.RoomCode)} · {payload.RoundsPlayed} rounds</text>""");
        sb.Append("</svg>");
        return sb.ToString();
    }

    public static string NotFoundSvg() =>
        $"""<svg xmlns="http://www.w3.org/2000/svg" width="{Width}" height="{Height}" viewBox="0 0 {Width} {Height}"><rect width="{Width}" height="{Height}" fill="#f4ecd8" /><text x="60" y="{Height / 2}" font-family="Georgia,serif" font-size="32" fill="#2b2318">This recap has expired.</text></svg>""";

    private static string Encode(string value) => WebUtility.HtmlEncode(value);
}
