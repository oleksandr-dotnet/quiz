using System.Collections.Immutable;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Triviador.Application.Content;
using Triviador.Domain.Primitives;
using Triviador.Domain.Questions;

namespace Triviador.Infrastructure.Content;

public sealed class QuestionRepository : IQuestionRepository
{
    private readonly ImmutableArray<Question> _questions;

    public QuestionRepository(IHostEnvironment environment)
    {
        var path = Path.Combine(environment.ContentRootPath, "Data", "questions", "questions.json");
        var json = File.ReadAllText(path);
        var raw = JsonSerializer.Deserialize<QuestionsJson>(json, JsonOptions)
            ?? throw new InvalidOperationException($"'{path}' did not deserialize to a question bank.");

        var errors = new List<string>();
        var builder = ImmutableArray.CreateBuilder<Question>();
        var seenIds = new HashSet<string>();

        foreach (var q in raw.Choice)
        {
            if (!seenIds.Add(q.Id))
            {
                errors.Add($"Duplicate question id '{q.Id}'.");
                continue;
            }

            var distinctOptions = q.Options.Where(o => !string.IsNullOrWhiteSpace(o)).Distinct().Count();
            if (distinctOptions < 2)
            {
                errors.Add($"Choice question '{q.Id}' needs at least 2 distinct non-empty options.");
                continue;
            }

            if (q.CorrectOptionIndex < 0 || q.CorrectOptionIndex >= q.Options.Length)
            {
                errors.Add($"Choice question '{q.Id}' has a correctOptionIndex out of range.");
                continue;
            }

            builder.Add(new Question(
                new QuestionPrompt(new QuestionId(q.Id), QuestionKind.Choice, q.Text, q.Options.ToImmutableArray(), null),
                q.CorrectOptionIndex,
                null));
        }

        foreach (var q in raw.Tip)
        {
            if (!seenIds.Add(q.Id))
            {
                errors.Add($"Duplicate question id '{q.Id}'.");
                continue;
            }

            builder.Add(new Question(
                new QuestionPrompt(new QuestionId(q.Id), QuestionKind.Tip, q.Text, ImmutableArray<string>.Empty, q.Unit),
                null,
                q.CorrectNumericValue));
        }

        if (errors.Count > 0)
        {
            throw new InvalidOperationException(
                $"'{path}' failed question validation:\n" + string.Join('\n', errors));
        }

        _questions = builder.ToImmutable();
    }

    public ImmutableArray<Question> AllQuestions() => _questions;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private sealed record QuestionsJson(ImmutableArray<ChoiceQuestionJson> Choice, ImmutableArray<TipQuestionJson> Tip);

    private sealed record ChoiceQuestionJson(string Id, string Text, ImmutableArray<string> Options, int CorrectOptionIndex);

    private sealed record TipQuestionJson(string Id, string Text, string? Unit, long CorrectNumericValue);
}
