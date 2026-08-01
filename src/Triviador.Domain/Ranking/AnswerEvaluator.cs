using Triviador.Domain.Questions;

namespace Triviador.Domain.Ranking;

public static class AnswerEvaluator
{
    public static AnswerScore Evaluate(Question question, AnswerValue answer) =>
        question.Prompt.Kind switch
        {
            QuestionKind.Choice => EvaluateChoice(question, answer),
            QuestionKind.Tip => EvaluateNumeric(question, answer),
            _ => throw new ArgumentOutOfRangeException(nameof(question), question.Prompt.Kind, "Unknown question kind."),
        };

    private static AnswerScore EvaluateChoice(Question question, AnswerValue answer)
    {
        if (answer is AnswerValue.Choice choice
            && question.CorrectOptionIndex is { } correctIndex
            && choice.OptionIndex >= 0
            && choice.OptionIndex < question.Prompt.Options.Length)
        {
            return choice.OptionIndex == correctIndex ? new AnswerScore(0, 0) : new AnswerScore(1, 0);
        }

        return new AnswerScore(2, 0);
    }

    private static AnswerScore EvaluateNumeric(Question question, AnswerValue answer)
    {
        if (answer is AnswerValue.Numeric numeric && question.CorrectNumericValue is { } correctValue)
        {
            return new AnswerScore(0, Math.Abs(numeric.Value - correctValue));
        }

        return new AnswerScore(1, 0);
    }
}
