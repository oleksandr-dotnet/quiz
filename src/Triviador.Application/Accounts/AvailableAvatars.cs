namespace Triviador.Application.Accounts;

/// The fixed, zero-infrastructure avatar set from design.md Decision 6 - an id here is what the
/// client renders (as a bundled icon/emoji) and the only thing the server ever validates against.
/// Not user-uploaded, not hot-linked from Google - see the decision for why.
public static class AvailableAvatars
{
    public static readonly IReadOnlyList<string> Ids =
    [
        "fox", "owl", "wolf", "bear", "lion", "eagle",
        "otter", "raven", "hawk", "stag", "boar", "lynx",
    ];

    private static readonly HashSet<string> IdSet = new(Ids, StringComparer.Ordinal);

    public static bool IsValid(string? avatarId) => avatarId is not null && IdSet.Contains(avatarId);
}
