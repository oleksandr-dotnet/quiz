namespace Triviador.Domain.State;

public enum GamePhase
{
    Lobby,
    // Entered from Lobby on StartGame only when GameRules.EnableCategoryBanDraft is true; otherwise
    // StartGame goes straight to BaseSelection exactly as before this phase existed.
    CategoryBan,
    BaseSelection,
    LandGrab,
    Battle,
    Finished,
}
