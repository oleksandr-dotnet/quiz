using Triviador.Domain.Primitives;

namespace Triviador.Domain.State;

// A closed hierarchy so PendingActivity.Question can pattern-match exhaustively on which phase asked
// it and why.
public abstract record QuestionPurpose
{
    public sealed record LandGrab(int DeadRoundCount) : QuestionPurpose;

    public sealed record Duel(PlayerId Attacker, PlayerId Defender, RegionId Region) : QuestionPurpose;

    public sealed record BaseAssault(PlayerId Attacker, PlayerId Defender, RegionId BaseRegion, int QuestionIndex, int DamageDealtThisTurn) : QuestionPurpose;
}
