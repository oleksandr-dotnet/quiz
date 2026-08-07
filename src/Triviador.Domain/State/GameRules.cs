namespace Triviador.Domain.State;

public sealed record GameRules(
    int MinPlayers = 2,
    int MaxPlayers = 4,
    int MinimumBaseDistance = 2,
    int BasePickDurationSeconds = 15,
    int RoundLimit = 12,
    int LandGrabPickDurationSeconds = 10,
    int ChoiceQuestionDurationSeconds = 12,
    int TipQuestionDurationSeconds = 20,
    int LandGrabDeadRoundThreshold = 3,
    int AttackTargetSelectionDurationSeconds = 15,
    int BaseHitPointsDefault = 5,
    int RevealHoldDurationSeconds = 7,
    int BaseAssaultUnlockRound = 8,
    // Shared by two mechanics: symmetric win/loss on each base-assault question, and a
    // defender-only award for successfully defending an ordinary duel — see PlayerState.BonusScore.
    int BaseAssaultScoreBonus = 200,
    Language Language = Language.Russian,
    // Three independently host-toggleable mechanics (see answer-streaks, category-ban-draft,
    // golden-question) - all default enabled. Fixed on GameRules the instant StartGame accepts;
    // never changed mid-game.
    bool EnableAnswerStreaks = true,
    bool EnableCategoryBanDraft = true,
    bool EnableGoldenQuestion = true,
    int AnswerStreakBonusPerStreak = 50,
    int CategoryBanProposalDurationSeconds = 20,
    int GoldenQuestionMinCount = 2,
    int GoldenQuestionMaxCount = 3,
    // Minimum number of non-golden questions (any purpose) asked between two golden questions, so
    // they read as spread out rather than clustered.
    int GoldenQuestionCooldownQuestions = 3)
{
    public static readonly GameRules Default = new();

    public static readonly GameRules Marathon = Default with { RoundLimit = 30 };
}
