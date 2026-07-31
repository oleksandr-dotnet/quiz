using Microsoft.Extensions.Logging;
using Triviador.Application.Content;

namespace Triviador.Application.Hosting;

public sealed class RoomFactory(
    IRoomBroadcaster broadcaster,
    IRoomClock clock,
    IMapRepository mapRepository,
    RoomOptions options,
    ILoggerFactory? loggerFactory = null) : IRoomFactory
{
    public RoomActor Create(string roomCode) =>
        new(roomCode, options, broadcaster, clock, mapRepository, loggerFactory?.CreateLogger<RoomActor>());
}
