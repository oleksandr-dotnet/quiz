using System.Collections.Immutable;
using Triviador.Domain.Primitives;
using Triviador.Domain.Ranking;

namespace Triviador.Domain.State;

// Only BasePick is driven by engine logic in this change. The other cases are declared now so the
// hierarchy's shape is settled — a future change that implements LandGrab/Battle can freely revise
// them since no working code depends on their exact fields yet.
public abstract record PendingActivity(ActivityToken Token, Instant Deadline)
{
    public sealed record BasePick(ActivityToken Token, Instant Deadline, PlayerId Player)
        : PendingActivity(Token, Deadline);

    public sealed record Question(
        ActivityToken Token,
        Instant Deadline,
        Instant AskedAt,
        Questions.Question Q,
        QuestionPurpose Purpose,
        ImmutableArray<PlayerId> Participants,
        ImmutableDictionary<PlayerId, AnswerSubmission> Submissions,
        TieBreakOrder TieBreak) : PendingActivity(Token, Deadline);

    public sealed record RegionPicks(
        ActivityToken Token,
        Instant Deadline,
        ImmutableArray<PlayerId> AwardQueue,
        int NextIndex) : PendingActivity(Token, Deadline);

    public sealed record TargetSelection(ActivityToken Token, Instant Deadline, PlayerId Player)
        : PendingActivity(Token, Deadline);

    public sealed record RevealHold(ActivityToken Token, Instant Deadline, QuestionResult Result)
        : PendingActivity(Token, Deadline);
}
