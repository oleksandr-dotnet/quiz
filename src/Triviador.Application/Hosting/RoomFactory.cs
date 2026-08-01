using Microsoft.Extensions.Logging;
using Triviador.Application.Content;
using Triviador.Domain.State;

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
    public RoomActor Create(string roomCode, Language language) =>
        new(roomCode, options, broadcaster, clock, mapRepository, randomSourceFactory, questionSourceFactory,
            language, loggerFactory?.CreateLogger<RoomActor>());
}
