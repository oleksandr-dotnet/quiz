using System.Collections.Immutable;
using Triviador.Domain.Primitives;
using Triviador.Domain.Ranking;

namespace Triviador.Domain.State;

public abstract record PendingActivity(ActivityToken Token, Instant Deadline)
{
    public sealed record BasePick(ActivityToken Token, Instant Deadline, PlayerId Player)
        : PendingActivity(Token, Deadline);

    // Simultaneous multi-participant, like Question: every active player proposes independently
    // against one shared deadline. Proposals stay off any pre-resolution projection (see
    // category-ban-draft's "in-flight proposals stay private" requirement) the same way Question's
    // Submissions never leak another participant's answer early.
    public sealed record CategoryBanProposal(
        ActivityToken Token,
        Instant Deadline,
        ImmutableArray<CategoryId> AvailableCategories,
        ImmutableArray<PlayerId> Participants,
        ImmutableDictionary<PlayerId, ImmutableArray<CategoryId>> Proposals) : PendingActivity(Token, Deadline);

    public sealed record Question(
        ActivityToken Token,
        Instant Deadline,
        Instant AskedAt,
        Questions.Question Q,
        QuestionPurpose Purpose,
        ImmutableArray<PlayerId> Participants,
        ImmutableDictionary<PlayerId, AnswerSubmission> Submissions,
        TieBreakOrder TieBreak,
        // Decided at ask time via golden-question's seeded scheduler, never revealed to any
        // projection before this question resolves - see golden-question's hidden-until-reveal
        // requirement. A NumericTiebreak question always inherits its Original's value rather than
        // rolling its own.
        bool IsGolden = false) : PendingActivity(Token, Deadline);

    public sealed record RegionPicks(
        ActivityToken Token,
        Instant Deadline,
        ImmutableArray<PlayerId> AwardQueue,
        int NextIndex) : PendingActivity(Token, Deadline);

    public sealed record TargetSelection(ActivityToken Token, Instant Deadline, PlayerId Player)
        : PendingActivity(Token, Deadline);

    // Purpose travels with the result so a RevealHold's own TimeoutElapsed knows which effect
    // (region transfer vs. base hit-point damage/capture) to apply once the reveal window ends.
    // IsGolden carries the resolved Question's own flag through to that later application.
    public sealed record RevealHold(
        ActivityToken Token, Instant Deadline, QuestionResult Result, QuestionPurpose Purpose, bool IsGolden = false)
        : PendingActivity(Token, Deadline);
}
