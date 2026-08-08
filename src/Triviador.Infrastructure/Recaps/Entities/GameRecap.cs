namespace Triviador.Infrastructure.Recaps.Entities;

public sealed class GameRecap
{
    public Guid Id { get; set; }

    /// See RecapFingerprint - unique index, the dedup key across every sharer of the same match.
    public string Fingerprint { get; set; } = string.Empty;

    public string RoomCode { get; set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }

    /// Computed once at insert time as CreatedAtUtc + RecapOptions.RetentionDays - a later change to
    /// the retention config never retroactively rescopes an already-written row (design.md Decision 6).
    public DateTimeOffset ExpiresAtUtc { get; set; }

    /// The first sharer, if signed in. Null for an anonymous share. Never changes after insert - a
    /// later sharer resolving to this same row (fingerprint dedup) does not reassign it.
    public Guid? SharedByUserId { get; set; }

    /// The full RecapPayloadDto, serialized. See design.md's Data Model - no denormalized listing
    /// columns; `ListForUserAsync` deserializes this at read time.
    public string PayloadJson { get; set; } = string.Empty;
}
