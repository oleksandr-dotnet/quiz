namespace Triviador.Domain.Primitives;

public readonly record struct ActivityToken(int Value)
{
    public static ActivityToken First => new(1);

    public ActivityToken Next() => new(Value + 1);

    public override string ToString() => Value.ToString();
}
