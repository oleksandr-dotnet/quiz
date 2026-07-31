using System.Collections.Concurrent;

namespace Triviador.Application.Hosting;

public sealed record ConnectionBinding(string RoomCode, Guid PlayerId);

/// Lets the hub resolve "which room/player does this connection belong to" in O(1),
/// so gameplay methods never take a room code as a parameter (a spoofing vector) and
/// OnDisconnectedAsync can find the right room without scanning every room.
public sealed class ConnectionMap
{
    private readonly ConcurrentDictionary<string, ConnectionBinding> _bindings = new();

    public void Bind(string connectionId, string roomCode, Guid playerId) =>
        _bindings[connectionId] = new ConnectionBinding(roomCode, playerId);

    public bool TryGet(string connectionId, out ConnectionBinding binding) =>
        _bindings.TryGetValue(connectionId, out binding!);

    public void Remove(string connectionId) => _bindings.TryRemove(connectionId, out _);
}
