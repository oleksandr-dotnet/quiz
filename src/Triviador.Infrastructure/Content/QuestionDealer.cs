using System.Collections.Immutable;
using Microsoft.Extensions.Logging;
using Triviador.Application.Content;
using Triviador.Domain.Abstractions;
using Triviador.Domain.Questions;
using Triviador.Domain.State;

namespace Triviador.Infrastructure.Content;

// Two Fisher-Yates-shuffled bags (choice + tip), popped from the front so a game never repeats a
// question until it has exhausted the bag - matching the master plan's dealer design. Seeded so a
// room's whole question sequence is reproducible from (seed, content).
public sealed class QuestionDealer : IQuestionSource
{
    private readonly Random _random;
    private readonly ILogger<QuestionDealer>? _logger;
    private readonly ImmutableArray<Question> _allChoice;
    private readonly ImmutableArray<Question> _allTip;
    private readonly Queue<Question> _choiceBag;
    private readonly Queue<Question> _tipBag;

    public QuestionDealer(int seed, IQuestionRepository repository, Language language, ILogger<QuestionDealer>? logger = null)
    {
        _random = new Random(seed);
        _logger = logger;

        var all = repository.AllQuestions(language);
        _allChoice = all.Where(q => q.Prompt.Kind == QuestionKind.Choice).ToImmutableArray();
        _allTip = all.Where(q => q.Prompt.Kind == QuestionKind.Tip).ToImmutableArray();
        _choiceBag = new Queue<Question>(Shuffle(_allChoice));
        _tipBag = new Queue<Question>(Shuffle(_allTip));
    }

    public Question Draw(QuestionDraw draw)
    {
        var kind = draw.Kind switch
        {
            QuestionKindRequest.Choice => QuestionKind.Choice,
            QuestionKindRequest.Tip => QuestionKind.Tip,
            QuestionKindRequest.Any => PickKindWeightedByRemaining(),
            _ => throw new ArgumentOutOfRangeException(nameof(draw), draw.Kind, "Unknown question kind request."),
        };

        return kind == QuestionKind.Choice
            ? ShuffleOptions(PopFrom(_choiceBag, _allChoice))
            : PopFrom(_tipBag, _allTip);
    }

    // The question bank stores the correct option at a fixed (usually first) index, so it must be
    // shuffled per draw or the UI would always show the answer in the same spot.
    private Question ShuffleOptions(Question question)
    {
        if (question.CorrectOptionIndex is not { } correctIndex)
        {
            return question;
        }

        var options = question.Prompt.Options;
        var order = Enumerable.Range(0, options.Length).ToArray();
        for (var i = order.Length - 1; i > 0; i--)
        {
            var j = _random.Next(i + 1);
            (order[i], order[j]) = (order[j], order[i]);
        }

        var shuffledOptions = ImmutableArray.CreateRange(order.Select(i => options[i]));
        var shuffledCorrectIndex = Array.IndexOf(order, correctIndex);

        return question with
        {
            Prompt = question.Prompt with { Options = shuffledOptions },
            CorrectOptionIndex = shuffledCorrectIndex,
        };
    }

    private QuestionKind PickKindWeightedByRemaining()
    {
        var choiceCount = _choiceBag.Count;
        var tipCount = _tipBag.Count;

        if (tipCount == 0)
        {
            return QuestionKind.Choice;
        }
        if (choiceCount == 0)
        {
            return QuestionKind.Tip;
        }

        return _random.Next(choiceCount + tipCount) < choiceCount ? QuestionKind.Choice : QuestionKind.Tip;
    }

    private Question PopFrom(Queue<Question> bag, ImmutableArray<Question> all)
    {
        if (bag.Count == 0)
        {
            _logger?.LogWarning("Question bag of {Count} exhausted; reshuffling.", all.Length);
            foreach (var q in Shuffle(all))
            {
                bag.Enqueue(q);
            }
        }

        return bag.Dequeue();
    }

    private ImmutableArray<Question> Shuffle(ImmutableArray<Question> items)
    {
        var array = items.ToArray();
        for (var i = array.Length - 1; i > 0; i--)
        {
            var j = _random.Next(i + 1);
            (array[i], array[j]) = (array[j], array[i]);
        }
        return ImmutableArray.Create(array);
    }
}

public sealed class QuestionSourceFactory(IQuestionRepository repository, ILoggerFactory? loggerFactory = null)
    : IQuestionSourceFactory
{
    public IQuestionSource Create(int seed, Language language) =>
        new QuestionDealer(seed, repository, language, loggerFactory?.CreateLogger<QuestionDealer>());
}
