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
    int LandGrabDeadRoundThreshold = 3)
{
    public static readonly GameRules Default = new();

    public static readonly GameRules Marathon = Default with { RoundLimit = 30 };
}
