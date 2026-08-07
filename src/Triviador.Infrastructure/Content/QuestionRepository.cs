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
    // The 13-category choice taxonomy and its 8-category tip subset, locked in by
    // openspec/changes/expand-question-bank-2000. Tip is restricted to categories that produce
    // genuinely estimable numeric facts - see that change's design.md for the rationale.
    private static readonly ImmutableHashSet<string> ChoiceCategories = ImmutableHashSet.Create(
        "geography", "history", "science", "nature", "sports", "pop-culture", "technology",
        "arts-literature", "mythology-religion", "space-astronomy", "food-drink",
        "economy-business", "language-wordplay");

    private static readonly ImmutableHashSet<string> TipCategories = ImmutableHashSet.Create(
        "geography", "history", "science", "nature", "sports", "pop-culture", "technology",
        "economy-business");

    private static readonly ImmutableHashSet<string> Difficulties = ImmutableHashSet.Create(
        "easy", "medium", "hard");

    private readonly ImmutableArray<ChoiceQuestionJson> _choice;
    private readonly ImmutableArray<TipQuestionJson> _tip;

    public QuestionRepository(IHostEnvironment environment)
    {
        var choiceDir = Path.Combine(environment.ContentRootPath, "Data", "questions", "choice");
        var tipDir = Path.Combine(environment.ContentRootPath, "Data", "questions", "tip");

        var errors = new List<string>();
        var seenIds = new HashSet<string>();

        var choiceBuilder = ImmutableArray.CreateBuilder<ChoiceQuestionJson>();
        foreach (var file in EnumerateJsonFiles(choiceDir))
        {
            var category = Path.GetFileNameWithoutExtension(file);
            var questions = DeserializeFile<ImmutableArray<ChoiceQuestionJson>>(file);

            foreach (var q in questions)
            {
                ValidateCategory(q.Id, q.Category, category, ChoiceCategories, "choice", errors);
                ValidateDifficulty(q.Id, q.Difficulty, errors);

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

                choiceBuilder.Add(q);
            }
        }

        var tipBuilder = ImmutableArray.CreateBuilder<TipQuestionJson>();
        foreach (var file in EnumerateJsonFiles(tipDir))
        {
            var category = Path.GetFileNameWithoutExtension(file);
            var questions = DeserializeFile<ImmutableArray<TipQuestionJson>>(file);

            foreach (var q in questions)
            {
                ValidateCategory(q.Id, q.Category, category, TipCategories, "tip", errors);
                ValidateDifficulty(q.Id, q.Difficulty, errors);

                if (!seenIds.Add(q.Id))
                {
                    errors.Add($"Duplicate question id '{q.Id}'.");
                    continue;
                }

                if (string.IsNullOrWhiteSpace(q.Text) || string.IsNullOrWhiteSpace(q.TextRu))
                {
                    errors.Add($"Tip question '{q.Id}' is missing its English or Russian text.");
                    continue;
                }

                tipBuilder.Add(q);
            }
        }

        if (errors.Count > 0)
        {
            throw new InvalidOperationException(
                $"Question bank under '{Path.Combine(environment.ContentRootPath, "Data", "questions")}' failed validation:\n"
                + string.Join('\n', errors));
        }

        _choice = choiceBuilder.ToImmutable();
        _tip = tipBuilder.ToImmutable();
    }

    private static void ValidateCategory(
        string id, string category, string expectedCategory, ImmutableHashSet<string> knownCategories,
        string kind, List<string> errors)
    {
        if (!knownCategories.Contains(category))
        {
            errors.Add($"{kind} question '{id}' declares unknown category '{category}'.");
            return;
        }

        if (category != expectedCategory)
        {
            errors.Add(
                $"{kind} question '{id}' declares category '{category}' but was loaded from file '{expectedCategory}.json'.");
        }
    }

    private static void ValidateDifficulty(string id, string difficulty, List<string> errors)
    {
        if (!Difficulties.Contains(difficulty))
        {
            errors.Add($"Question '{id}' declares unknown difficulty '{difficulty}'.");
        }
    }

    private static IEnumerable<string> EnumerateJsonFiles(string directory)
    {
        if (!Directory.Exists(directory))
        {
            throw new InvalidOperationException($"Question directory '{directory}' does not exist.");
        }

        return Directory.EnumerateFiles(directory, "*.json").OrderBy(f => f, StringComparer.Ordinal);
    }

    private static T DeserializeFile<T>(string path)
    {
        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<T>(json, JsonOptions)
            ?? throw new InvalidOperationException($"'{path}' did not deserialize to a question array.");
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
                null,
                new CategoryId(q.Category)));
        }

        foreach (var q in _tip)
        {
            var text = language == Language.Russian ? q.TextRu : q.Text;
            var unit = language == Language.Russian ? q.UnitRu : q.Unit;
            builder.Add(new Question(
                new QuestionPrompt(new QuestionId(q.Id), QuestionKind.Tip, text, ImmutableArray<string>.Empty, unit),
                null,
                q.CorrectNumericValue,
                new CategoryId(q.Category)));
        }

        return builder.MoveToImmutable();
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private sealed record ChoiceQuestionJson(
        string Id, string Text, string TextRu, ImmutableArray<string> Options, ImmutableArray<string> OptionsRu,
        int CorrectOptionIndex, string Category, string Difficulty);

    private sealed record TipQuestionJson(
        string Id, string Text, string TextRu, string? Unit, string? UnitRu, long CorrectNumericValue,
        string Category, string Difficulty);
}
