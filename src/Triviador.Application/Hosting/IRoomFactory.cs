using Triviador.Domain.State;

namespace Triviador.Application.Hosting;

public interface IRoomFactory
{
    RoomActor Create(string roomCode, Language language, bool isSandbox = false);
}
