namespace Triviador.Application.Hosting;

public interface IRoomFactory
{
    RoomActor Create(string roomCode);
}
