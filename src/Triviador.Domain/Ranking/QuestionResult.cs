using System.Collections.Immutable;
using Triviador.Domain.Questions;

namespace Triviador.Domain.Ranking;

public sealed record QuestionResult(Question Question, ImmutableArray<RankedAnswer> Rankings);
