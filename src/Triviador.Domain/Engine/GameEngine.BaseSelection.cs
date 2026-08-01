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

        if (IsTooCloseToExistingBase(command.RegionId) && AnyRegionSatisfiesBaseDistance())
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

    private bool IsTooCloseToExistingBase(RegionId candidate) =>
        TakenBaseRegions().Any(b => _adjacency.HopDistance(candidate, b) < _state.Rules.MinimumBaseDistance);

    private bool AnyRegionSatisfiesBaseDistance()
    {
        var takenBases = TakenBaseRegions();
        return _state.Map.Regions
            .Where(r => _state.RegionOf(r.Id).OwnerId is null)
            .Any(r => takenBases.All(b => _adjacency.HopDistance(r.Id, b) >= _state.Rules.MinimumBaseDistance));
    }

    private ImmutableArray<RegionId> TakenBaseRegions() =>
        _state.Players.Where(p => p.BaseRegion is not null).Select(p => p.BaseRegion!.Value).ToImmutableArray();

    private RegionId PickAutoBaseRegion()
    {
        var freeRegions = _state.Map.Regions.Where(r => _state.RegionOf(r.Id).OwnerId is null).ToImmutableArray();
        var takenBases = TakenBaseRegions();

        if (takenBases.Length > 0)
        {
            var distant = freeRegions.FirstOrDefault(r =>
                takenBases.All(b => _adjacency.HopDistance(r.Id, b) >= _state.Rules.MinimumBaseDistance));
            if (distant is not null)
            {
                return distant.Id;
            }
        }

        return freeRegions[0].Id;
    }
}
