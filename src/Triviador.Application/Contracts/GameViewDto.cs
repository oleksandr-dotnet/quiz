using Triviador.Domain.Primitives;
using Triviador.Domain.Questions;
using Triviador.Domain.State;

namespace Triviador.Application.Contracts;

/// The viewer-aware projection `domain-kernel` deferred to this change: built from `GameState` for a
/// specific viewer. Secrecy starts to matter with `land-grab-phase`: `PendingQuestion` never carries
/// another participant's submitted answer before that question resolves, only `YourAnswer` (echoed
/// back so a refresh still shows "locked in") and each participant's `HasAnswered` flag.
public sealed record GameViewDto(
    GamePhase Phase,
    string MapViewBox,
    IReadOnlyList<RegionViewDto> Regions,
    IReadOnlyList<PlayerViewDto> Players,
    Guid? CurrentPickerPlayerId,
    DateTimeOffset? DeadlineUtc,
    Guid YouPlayerId,
    bool YouAreCurrentPicker,
    PendingQuestionViewDto? PendingQuestion,
    PendingRegionPickViewDto? PendingRegionPick,
    LastRevealDto? LastReveal,
    int CurrentRound,
    PendingAttackTargetViewDto? PendingAttackTarget,
    PendingRevealViewDto? PendingReveal,
    GameOutcomeDto? Outcome,
    PendingBasePickViewDto? PendingBasePick,
    BattleContextDto? Battle,
    Language Language,
    int RoundLimit,
    PendingCategoryBanViewDto? PendingCategoryBan,
    IReadOnlyList<string> BannedCategories);

public sealed record RegionViewDto(
    string RegionId, string Name, int Value, double CenterX, double CenterY, double Radius,
    double LabelX, double LabelY, IReadOnlyList<string> AdjacentTo,
    Guid? OwnerPlayerId, bool IsBase);

public sealed record PlayerViewDto(
    Guid PlayerId,
    int Seat,
    string? DisplayName,
    string? AvatarId,
    bool IsBot,
    bool IsConnected,
    string? BaseRegionId,
    int Score,
    bool Eliminated,
    int? BaseHitPoints,
    bool Withdrawn,
    int AnswerStreak);

/// Mirrors PendingQuestionViewDto's shape: HasSubmitted never reveals another player's proposed
/// categories before the draft resolves (see category-ban-draft's "in-flight proposals stay
/// private"), YourProposal echoes only the viewer's own submission back.
public sealed record PendingCategoryBanViewDto(
    IReadOnlyList<string> AvailableCategories,
    IReadOnlyDictionary<string, bool> HasSubmitted,
    IReadOnlyList<string>? YourProposal,
    DateTimeOffset Deadline);

/// Mirrors PendingRegionPickViewDto's shape for the one pending-activity kind that didn't already
/// project an eligible set: base picking. CurrentPickerPlayerId/DeadlineUtc/YouAreCurrentPicker stay
/// on GameViewDto itself for compatibility with call sites that only need those.
public sealed record PendingBasePickViewDto(
    Guid CurrentPickerPlayerId,
    IReadOnlyList<string> EligibleRegionIds,
    DateTimeOffset Deadline);

public enum BattleKindDto
{
    Duel,
    BaseAssault,
}

/// Describes only facts both combatants already know - never an in-flight or correct answer, which
/// PendingQuestionViewDto/PendingRevealViewDto already guarantee never leak.
public sealed record BattleContextDto(
    BattleKindDto Kind,
    string ContestedRegionId,
    Guid AttackerPlayerId,
    Guid DefenderPlayerId,
    int? AssaultQuestionIndex,
    int? DamageDealtThisTurn,
    bool IsTiebreakRound);

public enum AnswerKindDto
{
    Choice,
    Numeric,
    None,
}

public sealed record AnswerValueDto(AnswerKindDto Kind, int? OptionIndex, long? NumericValue)
{
    public static readonly AnswerValueDto None = new(AnswerKindDto.None, null, null);

    public static AnswerValueDto OfChoice(int optionIndex) => new(AnswerKindDto.Choice, optionIndex, null);

    public static AnswerValueDto OfNumeric(long value) => new(AnswerKindDto.Numeric, null, value);
}

public sealed record QuestionPromptDto(string QuestionId, QuestionKind Kind, string Text, IReadOnlyList<string> Options, string? Unit);

public sealed record PendingQuestionViewDto(
    QuestionPromptDto Prompt,
    IReadOnlyList<Guid> ParticipantPlayerIds,
    IReadOnlyDictionary<string, bool> HasAnswered,
    AnswerValueDto? YourAnswer,
    DateTimeOffset Deadline);

public sealed record PendingRegionPickViewDto(
    Guid CurrentPickerPlayerId,
    IReadOnlyList<string> EligibleRegionIds,
    DateTimeOffset Deadline);

public sealed record RevealedAnswerDto(Guid PlayerId, AnswerValueDto Answer, int Rank, long? ElapsedMs);

public sealed record LastRevealDto(
    QuestionPromptDto Prompt,
    AnswerValueDto CorrectAnswer,
    IReadOnlyList<RevealedAnswerDto> Answers,
    bool IsGolden);

public sealed record PendingAttackTargetViewDto(
    Guid CurrentAttackerPlayerId,
    IReadOnlyList<string> EligibleTargetRegionIds,
    DateTimeOffset Deadline);

/// Unlike LastReveal (a one-shot push attached to the single broadcast right after resolution),
/// PendingReveal reflects a live RevealHold pending activity - it appears on every broadcast for as
/// long as the reveal window is open, with its own server-driven deadline.
public sealed record PendingRevealViewDto(
    QuestionPromptDto Prompt,
    AnswerValueDto CorrectAnswer,
    IReadOnlyList<RevealedAnswerDto> Answers,
    DateTimeOffset Deadline,
    bool IsGolden);

public sealed record GameOutcomeDto(IReadOnlyList<Guid> WinnerPlayerIds);
