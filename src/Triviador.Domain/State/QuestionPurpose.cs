using Triviador.Domain.Primitives;

namespace Triviador.Domain.State;

// Declared as a closed hierarchy now so PendingActivity.Question can pattern-match exhaustively, but
// only the Lobby/BaseSelection phases are implemented by this change — LandGrab/Duel/BaseAssault
// logic lands with the future changes that own those phases.
public abstract record QuestionPurpose
{
    public sealed record LandGrab(int DeadRoundCount) : QuestionPurpose;

    public sealed record Duel(PlayerId Attacker, PlayerId Defender, RegionId Region) : QuestionPurpose;

    public sealed record BaseAssault(PlayerId Attacker, PlayerId Defender, RegionId BaseRegion, int QuestionIndex, int DamageDealtThisTurn) : QuestionPurpose;
}
