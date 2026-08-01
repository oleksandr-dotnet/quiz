namespace Triviador.Domain.Primitives;

public readonly record struct RegionId(string Value)
{
    public override string ToString() => Value;
}
