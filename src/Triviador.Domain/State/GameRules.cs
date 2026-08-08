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

    // Used only by dev-facing sandbox rooms (see test-mechanics-playground) - every duration is
    // stretched to an hour so a countdown never misleadingly reaches zero while a tester is mid
    // click (sandbox rooms never arm the real per-activity timer at all; every pending activity
    // only ever resolves via an explicit debug command), base assaults are legal from round one so
    // reaching that mechanic doesn't require playing out seven ordinary rounds first, and golden
    // questions are eligible on every question instead of spaced out. Every other rule (base HP,
    // score bonuses, streak bonus, round limit) stays identical to Default so scores/balance the
    // tester sees match a real game exactly.
    public static readonly GameRules Sandbox = Default with
    {
        BasePickDurationSeconds = 3600,
        LandGrabPickDurationSeconds = 3600,
        ChoiceQuestionDurationSeconds = 3600,
        TipQuestionDurationSeconds = 3600,
        AttackTargetSelectionDurationSeconds = 3600,
        RevealHoldDurationSeconds = 3600,
        CategoryBanProposalDurationSeconds = 3600,
        BaseAssaultUnlockRound = 1,
        GoldenQuestionCooldownQuestions = 0,
    };
}
