namespace Triviador.Domain.Primitives;

public readonly record struct CategoryId(string Value)
{
    public override string ToString() => Value;
}
