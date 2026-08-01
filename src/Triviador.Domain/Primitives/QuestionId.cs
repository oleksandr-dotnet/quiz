namespace Triviador.Domain.Primitives;

public readonly record struct QuestionId(string Value)
{
    public override string ToString() => Value;
}
