using Microsoft.Extensions.Logging;

namespace Triviador.Application.Hosting;

public sealed class RoomFactory(
    IRoomBroadcaster broadcaster,
    IRoomClock clock,
    RoomOptions options,
    ILoggerFactory? loggerFactory = null) : IRoomFactory
{
    public RoomActor Create(string roomCode) =>
        new(roomCode, options, broadcaster, clock, loggerFactory?.CreateLogger<RoomActor>());
}
