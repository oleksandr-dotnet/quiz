namespace Triviador.Application.Hosting;

public sealed record RoomOptions
{
    public int MaxSeats { get; init; } = 4;

    public TimeSpan IdleThreshold { get; init; } = TimeSpan.FromMinutes(15);

    public int MaxRooms { get; init; } = 200;
}
