using Triviador.Application.Contracts;

namespace Triviador.Application.Hosting;

public interface IRoomBroadcaster
{
    Task SendViewAsync(string connectionId, RoomViewDto view, CancellationToken ct = default);

    Task SendGameViewAsync(string connectionId, GameViewDto view, CancellationToken ct = default);

    Task SendClosedAsync(string connectionId, string reason, CancellationToken ct = default);
}
