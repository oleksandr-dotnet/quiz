using System.Collections.Immutable;
using Triviador.Domain.Primitives;

namespace Triviador.Domain.Questions;

public enum QuestionKind
{
    Choice,
    Tip,
}

// No answer field exists on this type — QuestionAsked carries only a QuestionPrompt, so there is no
// code path where the host could broadcast the answer early.
public sealed record QuestionPrompt(QuestionId Id, QuestionKind Kind, string Text, ImmutableArray<string> Options, string? Unit);
