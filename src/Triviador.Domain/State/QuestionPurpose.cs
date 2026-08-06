using Triviador.Domain.Primitives;

namespace Triviador.Domain.State;

// A closed hierarchy so PendingActivity.Question can pattern-match exhaustively on which phase asked
// it and why.
public abstract record QuestionPurpose
{
    public sealed record LandGrab(int DeadRoundCount) : QuestionPurpose;

    public sealed record Duel(PlayerId Attacker, PlayerId Defender, RegionId Region) : QuestionPurpose;

    public sealed record BaseAssault(PlayerId Attacker, PlayerId Defender, RegionId BaseRegion, int QuestionIndex, int DamageDealtThisTurn) : QuestionPurpose;

    // A Choice-kind Duel/BaseAssault question that tied on correctness (both attacker and defender
    // scored Tier 0) defers its decision to exactly one follow-up numeric question instead of
    // consulting elapsed time — see answer-ranking's numeric-tiebreak requirement. Original carries
    // whichever Duel/BaseAssault purpose triggered it, so its own fields (region, chain progress)
    // don't need duplicating; resolving the tiebreak re-dispatches to that purpose's normal
    // effect-applying logic, fed this question's ranking instead of the tied one.
    public sealed record NumericTiebreak(QuestionPurpose Original, PlayerId Attacker, PlayerId Defender) : QuestionPurpose;
}
