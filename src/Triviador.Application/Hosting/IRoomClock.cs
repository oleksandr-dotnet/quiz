namespace Triviador.Application.Hosting;

public interface IRoomClock
{
    DateTimeOffset UtcNow { get; }
}
