using Triviador.Domain.Questions;

namespace Triviador.Domain.Abstractions;

public interface IQuestionSource
{
    Question Draw(QuestionDraw draw);
}
