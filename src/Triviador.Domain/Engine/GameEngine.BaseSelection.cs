using System.Collections.Immutable;
using Triviador.Domain.Commands;
using Triviador.Domain.Events;
using Triviador.Domain.Primitives;
using Triviador.Domain.State;

namespace Triviador.Domain.Engine;

public sealed partial class GameEngine
{
    private CommandResult ExecuteSelectBase(SelectBase command)
    {
        if (_state.Phase == GamePhase.Finished)
        {
            return CommandResult.Rejected(RejectionCode.GameAlreadyFinished);
        }

        if (_state.Phase != GamePhase.BaseSelection)
        {
            return CommandResult.Rejected(RejectionCode.WrongPhase);
        }

        var player = _state.Players.FirstOrDefault(p => p.Id == command.PlayerId);
        if (player is null)
        {
            return CommandResult.Rejected(RejectionCode.UnknownPlayer);
        }

        if (_state.Pending is not PendingActivity.BasePick pending)
        {
            return CommandResult.Rejected(RejectionCode.NotAwaitingThisInput);
        }

        if (command.Token != pending.Token)
        {
            return CommandResult.Rejected(RejectionCode.StaleActivityToken);
        }

        if (pending.Player != command.PlayerId)
        {
            return CommandResult.Rejected(RejectionCode.NotYourTurn);
        }

        if (!_state.Map.Regions.Any(r => r.Id == command.RegionId))
        {
            return CommandResult.Rejected(RejectionCode.UnknownRegion);
        }

        if (_state.RegionOf(command.RegionId).OwnerId is not null)
        {
            return CommandResult.Rejected(RejectionCode.RegionAlreadyOwned);
        }

        if (!EligibleBaseRegions().Contains(command.RegionId))
        {
            return CommandResult.Rejected(RejectionCode.BaseTooCloseToExistingBase);
        }

        return CommandResult.Accepted(CompleteBasePick(player, command.RegionId, command.At));
    }

    private CommandResult ExecuteTimeoutElapsed(TimeoutElapsed command)
    {
        if (_state.Phase == GamePhase.Finished)
        {
            return CommandResult.Rejected(RejectionCode.GameAlreadyFinished);
        }

        if (_state.Pending is null || _state.Pending.Token != command.Token)
        {
            // Stale or duplicate fire: harmless no-op, per the plan's timer design — never an
            // exception or a rejection.
            return CommandResult.Accepted(ImmutableArray<IGameEvent>.Empty);
        }

        if (command.At < _state.Pending.Deadline)
        {
            return CommandResult.Rejected(RejectionCode.DeadlineNotReached);
        }

        return _state.Pending switch
        {
            PendingActivity.BasePick pick => CommandResult.Accepted(TimeoutBasePick(pick, command.At)),
            PendingActivity.Question question => CommandResult.Accepted(TimeoutQuestion(question, command.At)),
            PendingActivity.RegionPicks picks => CommandResult.Accepted(TimeoutRegionPick(picks, command.At)),
            PendingActivity.TargetSelection targetSelection => CommandResult.Accepted(TimeoutTargetSelection(targetSelection, command.At)),
            PendingActivity.RevealHold reveal => CommandResult.Accepted(ResolveRevealHold(reveal, command.At)),
            _ => CommandResult.Accepted(ImmutableArray<IGameEvent>.Empty),
        };
    }

    private ImmutableArray<IGameEvent> TimeoutBasePick(PendingActivity.BasePick pick, Instant at)
    {
        var player = _state.Players.First(p => p.Id == pick.Player);
        var regionId = PickAutoBaseRegion();
        return CompleteBasePick(player, regionId, at);
    }

    private ImmutableArray<IGameEvent> CompleteBasePick(PlayerState player, RegionId regionId, Instant at)
    {
        var region = _state.RegionOf(regionId);
        region.OwnerId = player.Id;
        player.BaseRegion = regionId;
        player.BaseHitPoints = _state.Rules.BaseHitPointsDefault;

        var events = ImmutableArray.CreateBuilder<IGameEvent>();
        events.Add(new BaseSelected(player.Id, regionId));

        var nextPlayer = NextPlayerForBasePick(player.Id);
        if (nextPlayer is null)
        {
            events.Add(new BaseSelectionCompleted());
            events.AddRange(StartLandGrab(at));
        }
        else
        {
            events.Add(StartBasePick(nextPlayer.Value, at));
        }

        return events.ToImmutable();
    }

    private PlayerId? NextPlayerForBasePick(PlayerId justPicked)
    {
        var players = _state.Players;
        var pickedIndex = -1;
        for (var i = 0; i < players.Count; i++)
        {
            if (players[i].Id == justPicked)
            {
                pickedIndex = i;
                break;
            }
        }

        for (var i = pickedIndex + 1; i < players.Count; i++)
        {
            if (players[i].BaseRegion is null)
            {
                return players[i].Id;
            }
        }

        for (var i = 0; i <= pickedIndex; i++)
        {
            if (players[i].BaseRegion is null)
            {
                return players[i].Id;
            }
        }

        return null;
    }

    // Single source of truth for base-pick legality: reused by ExecuteSelectBase's validation, by
    // PickAutoBaseRegion's timeout auto-pick, and by RoomActor's projection to the client. Regions
    // within MinimumBaseDistance of every existing base are excluded, unless that would leave no
    // free region eligible at all - the same "waived when nothing qualifies" fallback the timeout
    // auto-pick already relied on before this method existed. Order follows MapDescriptor.Regions
    // declaration order, per the repo's canonical-iteration-order convention.
    public ImmutableArray<RegionId> EligibleBaseRegions()
    {
        var freeRegions = _state.Map.Regions
            .Where(r => _state.RegionOf(r.Id).OwnerId is null)
            .Select(r => r.Id)
            .ToImmutableArray();

        var takenBases = TakenBaseRegions();
        if (takenBases.Length == 0)
        {
            return freeRegions;
        }

        var distant = freeRegions
            .Where(r => takenBases.All(b => _adjacency.HopDistance(r, b) >= _state.Rules.MinimumBaseDistance))
            .ToImmutableArray();

        return distant.Length > 0 ? distant : freeRegions;
    }

    private ImmutableArray<RegionId> TakenBaseRegions() =>
        _state.Players.Where(p => p.BaseRegion is not null).Select(p => p.BaseRegion!.Value).ToImmutableArray();

    private RegionId PickAutoBaseRegion() => EligibleBaseRegions()[0];
}
