using System.Collections.Immutable;
using Triviador.Domain.Questions;

namespace Triviador.Domain.Ranking;

public static class AnswerRanker
{
    public static ImmutableArray<RankedAnswer> Rank(Question question, ImmutableArray<AnswerSubmission> submissions, TieBreakOrder tieBreak)
    {
        var ordered = submissions
            .Select(s => (s.Player, s.Answer, s.Elapsed, Score: AnswerEvaluator.Evaluate(question, s.Answer)))
            .OrderBy(s => s.Score.Tier)
            .ThenBy(s => s.Score.Penalty)
            .ThenBy(s => s.Elapsed ?? TimeSpan.MaxValue)
            .ThenBy(s => tieBreak.IndexOf(s.Player))
            .ToImmutableArray();

        var result = ImmutableArray.CreateBuilder<RankedAnswer>(ordered.Length);
        for (var i = 0; i < ordered.Length; i++)
        {
            var entry = ordered[i];
            result.Add(new RankedAnswer(entry.Player, entry.Answer, entry.Score, entry.Elapsed, i + 1));
        }

        return result.ToImmutable();
    }
}
