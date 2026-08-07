using System.Collections.Immutable;
using Triviador.Domain.Primitives;
using Triviador.Domain.Questions;
using Triviador.Domain.Ranking;
using Triviador.Domain.State;

namespace Triviador.Domain.Events;

public interface IGameEvent
{
}

public sealed record PlayerJoined(PlayerId PlayerId, int Seat) : IGameEvent;

public sealed record PlayerLeft(PlayerId PlayerId) : IGameEvent;

public sealed record GameStarted : IGameEvent;

// category-ban-draft: available categories are shown to every player, but individual proposals stay
// private (no event echoes another player's picks) until CategoryBansResolved.
public sealed record CategoryBanDraftStarted(
    ActivityToken Token, ImmutableArray<CategoryId> AvailableCategories, Instant Deadline) : IGameEvent;

public sealed record CategoryBanProposalAcknowledged(PlayerId PlayerId) : IGameEvent;

// One entry per active player at draft time, keyed by whichever category their own seeded draw
// banned (see category-ban-draft's resolution requirement); BannedCategories is the deduplicated
// set actually excluded from question selection for the rest of the game.
public sealed record CategoryBansResolved(
    ImmutableDictionary<PlayerId, CategoryId> BannedByPlayer, ImmutableArray<CategoryId> BannedCategories) : IGameEvent;

public sealed record BasePickRequested(ActivityToken Token, PlayerId PlayerId, Instant Deadline) : IGameEvent;

public sealed record BaseSelected(PlayerId PlayerId, RegionId RegionId) : IGameEvent;

public sealed record BaseSelectionCompleted : IGameEvent;

public sealed record QuestionAsked(
    ActivityToken Token,
    QuestionPrompt Prompt,
    QuestionPurpose Purpose,
    ImmutableArray<PlayerId> Participants,
    Instant Deadline) : IGameEvent;

public sealed record AnswerAcknowledged(PlayerId PlayerId) : IGameEvent;

public sealed record QuestionResolved(QuestionResult Result) : IGameEvent;

public sealed record RegionPickRequested(
    ActivityToken Token,
    PlayerId PlayerId,
    ImmutableArray<RegionId> EligibleRegionIds,
    Instant Deadline) : IGameEvent;

public sealed record RegionAwarded(PlayerId PlayerId, RegionId RegionId) : IGameEvent;

public sealed record LandGrabCompleted : IGameEvent;

public sealed record AttackTargetRequested(
    ActivityToken Token,
    PlayerId PlayerId,
    ImmutableArray<RegionId> EligibleTargetRegionIds,
    Instant Deadline) : IGameEvent;

public sealed record TurnSkipped(PlayerId PlayerId) : IGameEvent;

public sealed record RevealHoldStarted(ActivityToken Token, QuestionResult Result, Instant Deadline) : IGameEvent;

public sealed record RegionCaptured(PlayerId AttackerId, PlayerId DefenderId, RegionId RegionId) : IGameEvent;

public sealed record BaseHitPointsChanged(PlayerId DefenderId, int RemainingHitPoints) : IGameEvent;

public sealed record BaseCaptured(
    PlayerId AttackerId,
    PlayerId DefenderId,
    RegionId BaseRegionId,
    ImmutableArray<RegionId> TransferredRegionIds) : IGameEvent;

public sealed record PlayerEliminated(PlayerId PlayerId) : IGameEvent;

// Emitted alongside RegionCaptured/BaseHitPointsChanged/BaseCaptured whenever a base-assault question
// resolves (every hit in a chain, and the question that ends one on a tie/defender win) — never for
// an ordinary duel or a self-heal. Deltas are always opposite and equal to
// GameRules.BaseAssaultScoreBonus in magnitude; AttackerId/DefenderId match the assault's roles
// regardless of who won.
public sealed record BaseAssaultScoreAdjusted(PlayerId AttackerId, PlayerId DefenderId, int AttackerDelta, int DefenderDelta) : IGameEvent;

// Emitted whenever an ordinary (non-base) duel resolves with the defender keeping the region -
// a better rank, a tie (including a double timeout), or a withdrawn attacker. Unlike
// BaseAssaultScoreAdjusted this is one-sided: only the defender's score moves, by
// GameRules.BaseAssaultScoreBonus (the same tunable, reused rather than duplicated - see
// battle-flow spec). Never emitted when the attacker captures the region.
public sealed record DuelDefenseScoreAwarded(PlayerId DefenderId, PlayerId AttackerId, RegionId RegionId, int Amount) : IGameEvent;

// Emitted whenever a correct answer's streak increment awards a non-zero bonus (see answer-streaks) -
// StreakCount is the player's new streak after this answer; BonusAwarded is what was just added to
// BonusScore (already doubled if the question was golden). The persistent streak count itself is
// plain PlayerState, visible via projection; this event exists only to drive a one-shot animation.
public sealed record StreakBonusAwarded(PlayerId PlayerId, int StreakCount, int BonusAwarded) : IGameEvent;

// Companion event, emitted alongside QuestionResolved (and, for Battle questions, RevealHoldStarted)
// exactly when the resolving question was golden - see golden-question's hidden-until-reveal
// requirement. Carries no other payload: every doubled effect is already visible on the ordinary
// events (RegionAwarded/RegionPickRequested queue size, DuelDefenseScoreAwarded,
// BaseAssaultScoreAdjusted, BaseHitPointsChanged, StreakBonusAwarded) this event merely explains.
public sealed record GoldenQuestionRevealed(ActivityToken Token) : IGameEvent;

public sealed record PlayerWithdrawn(PlayerId PlayerId, ImmutableArray<RegionId> ReleasedRegionIds) : IGameEvent;

public sealed record RoundAdvanced(int RoundNumber) : IGameEvent;

public sealed record BattleCompleted : IGameEvent;

public sealed record GameFinished(GameOutcome Outcome) : IGameEvent;
