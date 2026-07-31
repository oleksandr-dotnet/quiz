using Triviador.Application.Hosting;

namespace Triviador.Infrastructure.Hosting;

public sealed class SystemClock : IRoomClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
