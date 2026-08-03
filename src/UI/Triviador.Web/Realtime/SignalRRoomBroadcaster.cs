using Microsoft.AspNetCore.SignalR;
using Triviador.Application.Contracts;
using Triviador.Application.Hosting;

namespace Triviador.Web.Realtime;

/// The one place `IRoomBroadcaster` (an Application port) meets SignalR. Lives here,
/// not in Infrastructure, because `IHubContext<GameHub>` is generic on the concrete
/// Hub type - see design.md's correction note for why that rules out Infrastructure.
public sealed class SignalRRoomBroadcaster(IHubContext<GameHub, IGameClient> hub) : IRoomBroadcaster
{
    public Task SendViewAsync(string connectionId, RoomViewDto view, CancellationToken ct = default) =>
        hub.Clients.Client(connectionId).State(view);

    public Task SendGameViewAsync(string connectionId, GameViewDto view, CancellationToken ct = default) =>
        hub.Clients.Client(connectionId).GameState(view);

    public Task SendClosedAsync(string connectionId, string reason, CancellationToken ct = default) =>
        hub.Clients.Client(connectionId).RoomClosed(reason);

    public Task SendKickedAsync(string connectionId, string reason, CancellationToken ct = default) =>
        hub.Clients.Client(connectionId).Kicked(reason);
}
