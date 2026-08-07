using Triviador.Application.Contracts;

namespace Triviador.Web.Realtime;

public interface IGameClient
{
    Task State(RoomViewDto view);

    Task GameState(GameViewDto view);

    Task RoomClosed(string reason);

    Task Kicked(string reason);

    Task Emote(Guid playerId, string emoteId);
}
