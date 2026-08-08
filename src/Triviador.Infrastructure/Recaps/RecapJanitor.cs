using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Triviador.Application.Hosting;
using Triviador.Application.Recaps;

namespace Triviador.Infrastructure.Recaps;

/// Mirrors RoomJanitor's shape (a BackgroundService on a periodic sweep) - see design.md Decision 6.
/// Unlike RoomJanitor, IRecapRepository sits on the scoped TriviadorDbContext, so each sweep opens
/// its own DI scope rather than holding a singleton repository instance.
public sealed class RecapJanitor(
    IServiceScopeFactory scopeFactory, IRoomClock clock, ILogger<RecapJanitor> logger) : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(SweepInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            using var scope = scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<IRecapRepository>();
            var deleted = await repository.DeleteExpiredAsync(clock.UtcNow, stoppingToken);
            if (deleted > 0)
            {
                logger.LogInformation("Deleted {Count} expired game recap(s)", deleted);
            }
        }
    }
}
