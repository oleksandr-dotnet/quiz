namespace Triviador.Domain.Primitives;

public readonly record struct Instant(long UnixMillis) : IComparable<Instant>
{
    public TimeSpan Since(Instant earlier) => TimeSpan.FromMilliseconds(UnixMillis - earlier.UnixMillis);

    public Instant Add(TimeSpan duration) => new(UnixMillis + (long)duration.TotalMilliseconds);

    public int CompareTo(Instant other) => UnixMillis.CompareTo(other.UnixMillis);

    public static bool operator <(Instant left, Instant right) => left.UnixMillis < right.UnixMillis;
    public static bool operator >(Instant left, Instant right) => left.UnixMillis > right.UnixMillis;
    public static bool operator <=(Instant left, Instant right) => left.UnixMillis <= right.UnixMillis;
    public static bool operator >=(Instant left, Instant right) => left.UnixMillis >= right.UnixMillis;
}
