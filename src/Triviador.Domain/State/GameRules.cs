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
    Language Language = Language.Russian)
{
    public static readonly GameRules Default = new();

    public static readonly GameRules Marathon = Default with { RoundLimit = 30 };
}
