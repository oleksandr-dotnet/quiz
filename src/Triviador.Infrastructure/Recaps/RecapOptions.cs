namespace Triviador.Infrastructure.Recaps;

public sealed class RecapOptions
{
    /// How long a shared recap stays reachable after creation. Computed into `ExpiresAtUtc` once, at
    /// insert time (design.md Decision 6) - changing this later only affects newly created recaps.
    /// Overridable without a redeploy via the `Recap__RetentionDays` env var.
    public int RetentionDays { get; set; } = 14;
}
