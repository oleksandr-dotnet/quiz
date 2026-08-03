using System.Collections.Immutable;
using Triviador.Domain.Commands;
using Triviador.Domain.Events;
using Triviador.Domain.Primitives;
using Triviador.Domain.State;

namespace Triviador.Domain.Engine;

public sealed partial class GameEngine
{
    // Host-initiated removal with territory release (host-kick-player). Distinct from LeaveGame
    // (Lobby-only, self-service): this works at any post-Lobby phase, targets any player, releases
    // their territory to neutral instead of leaving it with them, and immediately reroutes past them
    // if they currently hold the turn — see design.md's Decision D3 for why BasePick/RegionPicks/
    // TargetSelection need an active reroute here while Question/RevealHold don't.
    private CommandResult ExecuteWithdrawPlayer(WithdrawPlayer command)
    {
        if (_state.Phase == GamePhase.Finished)
        {
            return CommandResult.Rejected(RejectionCode.GameAlreadyFinished);
        }

        if (_state.Phase == GamePhase.Lobby)
        {
            return CommandResult.Rejected(RejectionCode.WrongPhase);
        }

        var player = _state.Players.FirstOrDefault(p => p.Id == command.PlayerId);
        if (player is null)
        {
            return CommandResult.Rejected(RejectionCode.UnknownPlayer);
        }

        if (player.Eliminated || player.Withdrawn)
        {
            return CommandResult.Rejected(RejectionCode.PlayerAlreadyWithdrawn);
        }

        var releasedRegions = _state.Regions
            .Where(r => r.OwnerId == player.Id)
            .Select(r => r.Id)
            .ToImmutableArray();
        foreach (var regionId in releasedRegions)
        {
            _state.RegionOf(regionId).OwnerId = null;
        }

        player.Withdrawn = true;

        var events = ImmutableArray.CreateBuilder<IGameEvent>();
        events.Add(new PlayerWithdrawn(player.Id, releasedRegions));
        events.AddRange(RerouteAfterWithdrawal(player.Id, command.At));

        return CommandResult.Accepted(events.ToImmutable());
    }

    // Only reroutes when the withdrawn player was THE current required actor for a turn-driving
    // pending activity — otherwise leaving Pending untouched is already correct (a Question simply
    // resolves later via the existing timeout fallback; a RevealHold has no player action pending
    // regardless; a later, not-yet-current RegionPicks queue slot is skipped lazily when its turn
    // would arrive, per AdvanceRegionPickQueue's own skip-loop).
    private ImmutableArray<IGameEvent> RerouteAfterWithdrawal(PlayerId withdrawnPlayerId, Instant at) =>
        _state.Pending switch
        {
            PendingActivity.BasePick pick when pick.Player == withdrawnPlayerId =>
                AdvanceBasePickPast(withdrawnPlayerId, at),

            PendingActivity.RegionPicks picks when picks.AwardQueue[picks.NextIndex] == withdrawnPlayerId =>
                AdvanceRegionPickQueue(picks, picks.NextIndex, at),

            PendingActivity.TargetSelection ts when ts.Player == withdrawnPlayerId =>
                AdvanceTurn(at),

            _ => ImmutableArray<IGameEvent>.Empty,
        };
}
