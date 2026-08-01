namespace Triviador.Domain.Questions;

public abstract record AnswerValue
{
    public sealed record Choice(int OptionIndex) : AnswerValue;

    public sealed record Numeric(long Value) : AnswerValue;

    public sealed record None : AnswerValue
    {
        public static readonly None Instance = new();
    }
}
