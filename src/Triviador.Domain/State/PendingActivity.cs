using System.Collections.Immutable;
using Triviador.Domain.Primitives;
using Triviador.Domain.Ranking;

namespace Triviador.Domain.State;

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

    // Purpose travels with the result so a RevealHold's own TimeoutElapsed knows which effect
    // (region transfer vs. base hit-point damage/capture) to apply once the reveal window ends.
    public sealed record RevealHold(ActivityToken Token, Instant Deadline, QuestionResult Result, QuestionPurpose Purpose)
        : PendingActivity(Token, Deadline);
}
