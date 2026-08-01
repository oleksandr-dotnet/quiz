using Triviador.Domain.Primitives;
using Triviador.Domain.Questions;

namespace Triviador.Domain.Ranking;

public sealed record RankedAnswer(PlayerId Player, AnswerValue Answer, AnswerScore Score, TimeSpan? Elapsed, int Rank);
