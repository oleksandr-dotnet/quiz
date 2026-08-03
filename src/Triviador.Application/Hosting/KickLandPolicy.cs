namespace Triviador.Application.Hosting;

/// The host's choice for a kicked player's territory once a game is in progress. Only meaningful
/// mid-game — a lobby kick has no territory to dispose of. BotTakeover never touches the domain
/// engine (bots are invisible to GameEngine); ReleaseLand dispatches WithdrawPlayer.
public enum KickLandPolicy
{
    ReleaseLand,
    BotTakeover,
}
