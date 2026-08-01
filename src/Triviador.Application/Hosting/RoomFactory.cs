using Microsoft.Extensions.Logging;
using Triviador.Application.Content;

namespace Triviador.Application.Hosting;

public sealed class RoomFactory(
    IRoomBroadcaster broadcaster,
    IRoomClock clock,
    IMapRepository mapRepository,
    IRandomSourceFactory randomSourceFactory,
    IQuestionSourceFactory questionSourceFactory,
    RoomOptions options,
    ILoggerFactory? loggerFactory = null) : IRoomFactory
{
    public RoomActor Create(string roomCode) =>
        new(roomCode, options, broadcaster, clock, mapRepository, randomSourceFactory, questionSourceFactory,
            loggerFactory?.CreateLogger<RoomActor>());
}
