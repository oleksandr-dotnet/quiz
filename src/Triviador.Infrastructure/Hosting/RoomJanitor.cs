using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Triviador.Application.Hosting;

namespace Triviador.Infrastructure.Hosting;

/// A hosting-runtime concern (BackgroundService), not orchestration - that's why it
/// lives here rather than beside RoomActor in Triviador.Application.
public sealed class RoomJanitor(
    RoomRegistry registry,
    IRoomClock clock,
    RoomOptions options,
    ILogger<RoomJanitor> logger) : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromSeconds(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(SweepInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            var now = clock.UtcNow;
            foreach (var room in registry.All)
            {
                if (room.HasConnectedHuman || now - room.LastActivityUtc <= options.IdleThreshold)
                {
                    continue;
                }

                registry.Remove(room.RoomCode);
                await room.ShutdownAsync();
                logger.LogInformation("Evicted idle room {RoomCode}", room.RoomCode);
            }
        }
    }
}
