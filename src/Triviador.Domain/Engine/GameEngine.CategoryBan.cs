using System.Collections.Immutable;
using Triviador.Domain.Commands;
using Triviador.Domain.Events;
using Triviador.Domain.Primitives;
using Triviador.Domain.State;

namespace Triviador.Domain.Engine;

public sealed partial class GameEngine
{
    private ImmutableArray<IGameEvent> StartCategoryBanDraft(Instant at)
    {
        _state.Phase = GamePhase.CategoryBan;
        var participants = ActiveParticipants();
        var available = _questions.AvailableCategories();
        var token = _state.IssueActivityToken();
        var deadline = at.Add(TimeSpan.FromSeconds(_state.Rules.CategoryBanProposalDurationSeconds));

        _state.Pending = new PendingActivity.CategoryBanProposal(
            token, deadline, available, participants, ImmutableDictionary<PlayerId, ImmutableArray<CategoryId>>.Empty);

        return ImmutableArray.Create<IGameEvent>(new CategoryBanDraftStarted(token, available, deadline));
    }

    private CommandResult ExecuteProposeCategoryBans(ProposeCategoryBans command)
    {
        if (_state.Phase == GamePhase.Finished)
        {
            return CommandResult.Rejected(RejectionCode.GameAlreadyFinished);
        }

        if (_state.Phase != GamePhase.CategoryBan)
        {
            return CommandResult.Rejected(RejectionCode.WrongPhase);
        }

        if (_state.Players.All(p => p.Id != command.PlayerId))
        {
            return CommandResult.Rejected(RejectionCode.UnknownPlayer);
        }

        if (_state.Pending is not PendingActivity.CategoryBanProposal pending)
        {
            return CommandResult.Rejected(RejectionCode.NotAwaitingThisInput);
        }

        if (command.Token != pending.Token)
        {
            return CommandResult.Rejected(RejectionCode.StaleActivityToken);
        }

        if (!pending.Participants.Contains(command.PlayerId))
        {
            return CommandResult.Rejected(RejectionCode.NotYourTurn);
        }

        if (pending.Proposals.ContainsKey(command.PlayerId))
        {
            return CommandResult.Rejected(RejectionCode.AlreadyAnswered);
        }

        if (command.Categories.Length > 3 || command.Categories.Distinct().Count() != command.Categories.Length)
        {
            return CommandResult.Rejected(RejectionCode.InvalidCategoryProposal);
        }

        if (command.Categories.Any(c => !pending.AvailableCategories.Contains(c)))
        {
            return CommandResult.Rejected(RejectionCode.UnknownCategory);
        }

        var updatedProposals = pending.Proposals.SetItem(command.PlayerId, command.Categories);
        var updatedPending = pending with { Proposals = updatedProposals };
        _state.Pending = updatedPending;

        var events = ImmutableArray.CreateBuilder<IGameEvent>();
        events.Add(new CategoryBanProposalAcknowledged(command.PlayerId));

        if (updatedProposals.Count >= pending.Participants.Length)
        {
            events.AddRange(ResolveCategoryBanDraft(updatedPending, command.At));
        }

        return CommandResult.Accepted(events.ToImmutable());
    }

    private ImmutableArray<IGameEvent> TimeoutCategoryBanProposal(PendingActivity.CategoryBanProposal pending, Instant at) =>
        ResolveCategoryBanDraft(pending, at);

    // Resolves in seat order (canonical iteration order) rather than submission-arrival order, so
    // replay from (seed, command log) reproduces the same banned set regardless of network timing -
    // see category-ban-draft's "resolution is deterministic for a given seed" requirement.
    private ImmutableArray<IGameEvent> ResolveCategoryBanDraft(PendingActivity.CategoryBanProposal pending, Instant at)
    {
        var banned = ImmutableHashSet.CreateBuilder<CategoryId>();
        var bannedByPlayer = ImmutableDictionary.CreateBuilder<PlayerId, CategoryId>();

        foreach (var player in _state.Players)
        {
            if (!pending.Participants.Contains(player.Id))
            {
                continue;
            }

            var proposal = pending.Proposals.TryGetValue(player.Id, out var p) ? p : ImmutableArray<CategoryId>.Empty;

            CategoryId chosen;
            if (proposal.Length > 0)
            {
                chosen = proposal[_random.NextInt(0, proposal.Length)];
            }
            else
            {
                var remaining = pending.AvailableCategories.Where(c => !banned.Contains(c)).ToImmutableArray();
                var pool = remaining.Length > 0 ? remaining : pending.AvailableCategories;
                chosen = pool[_random.NextInt(0, pool.Length)];
            }

            banned.Add(chosen);
            bannedByPlayer[player.Id] = chosen;
        }

        _state.BannedCategories = banned.ToImmutable();
        _state.Phase = GamePhase.BaseSelection;
        _state.Pending = null;

        var events = ImmutableArray.CreateBuilder<IGameEvent>();
        events.Add(new CategoryBansResolved(bannedByPlayer.ToImmutable(), _state.BannedCategories.ToImmutableArray()));
        events.Add(StartBasePick(_state.Players[0].Id, at));
        return events.ToImmutable();
    }
}
