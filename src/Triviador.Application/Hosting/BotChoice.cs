using System.Collections.Immutable;
using Triviador.Domain.Abstractions;
using Triviador.Domain.Primitives;
using Triviador.Domain.Questions;

namespace Triviador.Application.Hosting;

/// Pure decision-making for bot seats: given the same eligible-choice sets and prompt information
/// a human client would see, produce the value a bot submits. Never given access to a Question's
/// correct answer - a bot guesses blind, same information limit a human has.
public static class BotChoice
{
    private const int TipGuessUpperBoundExclusive = 1_000;

    public static RegionId PickRegion(ImmutableArray<RegionId> eligible, IRandomSource random) =>
        eligible[random.NextInt(0, eligible.Length)];

    public static AnswerValue Answer(QuestionPrompt prompt, IRandomSource random) => prompt.Kind switch
    {
        QuestionKind.Choice => new AnswerValue.Choice(random.NextInt(0, prompt.Options.Length)),
        QuestionKind.Tip => new AnswerValue.Numeric(random.NextInt(0, TipGuessUpperBoundExclusive)),
        _ => AnswerValue.None.Instance,
    };

    private const double MinDelayFraction = 0.25;
    private const double MaxDelayFraction = 0.65;
    private static readonly TimeSpan MinDelay = TimeSpan.FromSeconds(1);
    private static readonly TimeSpan MaxDelay = TimeSpan.FromSeconds(6);
    private static readonly TimeSpan SafetyMargin = TimeSpan.FromMilliseconds(250);

    /// A randomized "thinking time" scaled to whatever time remains on the current activity, so a
    /// bot's pacing looks human regardless of which activity's own duration is in effect. Always
    /// leaves a safety margin before the real deadline so the bot's own submission - not a raw
    /// timeout - is what resolves the activity in the normal case.
    public static TimeSpan ThinkingDelay(TimeSpan remaining, IRandomSource random)
    {
        if (remaining <= TimeSpan.Zero)
        {
            return TimeSpan.Zero;
        }

        var fraction = MinDelayFraction + (MaxDelayFraction - MinDelayFraction) * (random.NextInt(0, 1000) / 1000.0);
        var delay = TimeSpan.FromMilliseconds(remaining.TotalMilliseconds * fraction);

        if (delay < MinDelay)
        {
            delay = MinDelay;
        }
        else if (delay > MaxDelay)
        {
            delay = MaxDelay;
        }

        var safeMax = remaining - SafetyMargin;
        return delay > safeMax ? (safeMax < TimeSpan.Zero ? TimeSpan.Zero : safeMax) : delay;
    }
}
