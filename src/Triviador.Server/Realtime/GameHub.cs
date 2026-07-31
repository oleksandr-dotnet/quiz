using Microsoft.AspNetCore.SignalR;

namespace Triviador.Server.Realtime;

public sealed class GameHub : Hub
{
    public Task<string> Ping() => Task.FromResult("pong");
}
