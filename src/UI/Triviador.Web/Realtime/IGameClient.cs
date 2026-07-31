using Triviador.Application.Contracts;

namespace Triviador.Web.Realtime;

public interface IGameClient
{
    Task State(RoomViewDto view);

    Task RoomClosed(string reason);
}
