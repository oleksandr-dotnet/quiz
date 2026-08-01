using Triviador.Domain.Primitives;

namespace Triviador.Domain.Questions;

public sealed record Question(QuestionPrompt Prompt, int? CorrectOptionIndex, long? CorrectNumericValue)
{
    public QuestionId Id => Prompt.Id;
}
