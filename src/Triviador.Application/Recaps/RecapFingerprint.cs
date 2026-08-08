using System.Security.Cryptography;
using System.Text;

namespace Triviador.Application.Recaps;

/// Deterministic identity of a *finished match* (not of a single share request) - see design.md
/// Decision 2. Two different players sharing the same finished game compute the same fingerprint,
/// so the repository's upsert-by-fingerprint sends every sharer to the same recap id instead of
/// creating a duplicate row per sharer. Deliberately excludes wall-clock time: two players clicking
/// share a few seconds apart is the common case this must dedupe; an exact rematch (same players,
/// same round count, same winners) colliding is an accepted, extremely unlikely edge case.
public static class RecapFingerprint
{
    public static string Compute(RecapPayloadDto dto)
    {
        var playerIds = dto.Players.Select(p => p.PlayerId).OrderBy(id => id).Select(id => id.ToString("N"));
        var winnerIds = dto.WinnerPlayerIds.OrderBy(id => id).Select(id => id.ToString("N"));

        var basis = string.Join('|',
            dto.RoomCode.Trim().ToUpperInvariant(),
            string.Join(',', playerIds),
            dto.RoundsPlayed.ToString(),
            string.Join(',', winnerIds));

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(basis));
        return Convert.ToHexString(hash);
    }
}
