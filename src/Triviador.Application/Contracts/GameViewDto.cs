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
    bool LandGrabComplete);

public sealed record RegionViewDto(string RegionId, int Value, string RenderPath, Guid? OwnerPlayerId, bool IsBase);

public sealed record PlayerViewDto(Guid PlayerId, int Seat, string? DisplayName, bool IsBot, string? BaseRegionId, int Score);

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
    IReadOnlyList<RevealedAnswerDto> Answers);
