namespace Triviador.Domain.Questions;

public enum QuestionKindRequest
{
    Any,
    Choice,
    Tip,
}

public sealed record QuestionDraw(QuestionKindRequest Kind);
