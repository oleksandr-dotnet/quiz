using Microsoft.AspNetCore.SignalR;

namespace Triviador.Web.Realtime;

public sealed class GameHub : Hub
{
    public Task<string> Ping() => Task.FromResult("pong");
}
