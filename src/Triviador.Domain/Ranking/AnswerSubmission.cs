using Triviador.Domain.Primitives;
using Triviador.Domain.Questions;

namespace Triviador.Domain.Ranking;

public sealed record AnswerSubmission(PlayerId Player, AnswerValue Answer, TimeSpan? Elapsed);
