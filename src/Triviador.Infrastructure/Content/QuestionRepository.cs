using System.Collections.Immutable;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Triviador.Application.Content;
using Triviador.Domain.Primitives;
using Triviador.Domain.Questions;
using Triviador.Domain.State;

namespace Triviador.Infrastructure.Content;

public sealed class QuestionRepository : IQuestionRepository
{
    private readonly ImmutableArray<ChoiceQuestionJson> _choice;
    private readonly ImmutableArray<TipQuestionJson> _tip;

    public QuestionRepository(IHostEnvironment environment)
    {
        var path = Path.Combine(environment.ContentRootPath, "Data", "questions", "questions.json");
        var json = File.ReadAllText(path);
        var raw = JsonSerializer.Deserialize<QuestionsJson>(json, JsonOptions)
            ?? throw new InvalidOperationException($"'{path}' did not deserialize to a question bank.");

        var errors = new List<string>();
        var seenIds = new HashSet<string>();

        foreach (var q in raw.Choice)
        {
            if (!seenIds.Add(q.Id))
            {
                errors.Add($"Duplicate question id '{q.Id}'.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(q.Text) || string.IsNullOrWhiteSpace(q.TextRu))
            {
                errors.Add($"Choice question '{q.Id}' is missing its English or Russian text.");
                continue;
            }

            var distinctOptions = q.Options.Where(o => !string.IsNullOrWhiteSpace(o)).Distinct().Count();
            if (distinctOptions < 2)
            {
                errors.Add($"Choice question '{q.Id}' needs at least 2 distinct non-empty options.");
                continue;
            }

            if (q.OptionsRu.Length != q.Options.Length)
            {
                errors.Add($"Choice question '{q.Id}' has a Russian options list of different length than English.");
                continue;
            }

            if (q.CorrectOptionIndex < 0 || q.CorrectOptionIndex >= q.Options.Length)
            {
                errors.Add($"Choice question '{q.Id}' has a correctOptionIndex out of range.");
                continue;
            }
        }

        foreach (var q in raw.Tip)
        {
            if (!seenIds.Add(q.Id))
            {
                errors.Add($"Duplicate question id '{q.Id}'.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(q.Text) || string.IsNullOrWhiteSpace(q.TextRu))
            {
                errors.Add($"Tip question '{q.Id}' is missing its English or Russian text.");
            }
        }

        if (errors.Count > 0)
        {
            throw new InvalidOperationException(
                $"'{path}' failed question validation:\n" + string.Join('\n', errors));
        }

        _choice = raw.Choice;
        _tip = raw.Tip;
    }

    public ImmutableArray<Question> AllQuestions(Language language)
    {
        var builder = ImmutableArray.CreateBuilder<Question>(_choice.Length + _tip.Length);

        foreach (var q in _choice)
        {
            var text = language == Language.Russian ? q.TextRu : q.Text;
            var options = language == Language.Russian ? q.OptionsRu : q.Options;
            builder.Add(new Question(
                new QuestionPrompt(new QuestionId(q.Id), QuestionKind.Choice, text, options, null),
                q.CorrectOptionIndex,
                null));
        }

        foreach (var q in _tip)
        {
            var text = language == Language.Russian ? q.TextRu : q.Text;
            var unit = language == Language.Russian ? q.UnitRu : q.Unit;
            builder.Add(new Question(
                new QuestionPrompt(new QuestionId(q.Id), QuestionKind.Tip, text, ImmutableArray<string>.Empty, unit),
                null,
                q.CorrectNumericValue));
        }

        return builder.MoveToImmutable();
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private sealed record QuestionsJson(ImmutableArray<ChoiceQuestionJson> Choice, ImmutableArray<TipQuestionJson> Tip);

    private sealed record ChoiceQuestionJson(
        string Id, string Text, string TextRu, ImmutableArray<string> Options, ImmutableArray<string> OptionsRu,
        int CorrectOptionIndex);

    private sealed record TipQuestionJson(
        string Id, string Text, string TextRu, string? Unit, string? UnitRu, long CorrectNumericValue);
}
