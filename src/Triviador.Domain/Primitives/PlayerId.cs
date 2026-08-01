namespace Triviador.Domain.Primitives;

public readonly record struct PlayerId(Guid Value)
{
    public override string ToString() => Value.ToString();
}
