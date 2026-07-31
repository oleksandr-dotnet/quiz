using System.Collections.Concurrent;

namespace Triviador.Application.Hosting;

public sealed class RoomRegistry(IRoomFactory factory, IRoomCodeGenerator codeGenerator, RoomOptions options)
{
    private const int MaxCreateAttempts = 5;

    private readonly ConcurrentDictionary<string, RoomActor> _rooms = new(StringComparer.Ordinal);

    public IReadOnlyCollection<RoomActor> All => _rooms.Values.ToArray();

    public bool TryGet(string code, out RoomActor room) => _rooms.TryGetValue(Normalize(code), out room!);

    public RoomActor CreateRoom()
    {
        if (_rooms.Count >= options.MaxRooms)
        {
            throw new InvalidOperationException("The server is at capacity. Try again shortly.");
        }

        for (var attempt = 0; attempt < MaxCreateAttempts; attempt++)
        {
            var code = codeGenerator.NextCode();
            var room = factory.Create(code);
            if (_rooms.TryAdd(code, room))
            {
                return room;
            }
        }

        throw new InvalidOperationException("Could not allocate a unique room code.");
    }

    public void Remove(string code) => _rooms.TryRemove(Normalize(code), out _);

    private static string Normalize(string code) => code.Trim().ToUpperInvariant();
}
