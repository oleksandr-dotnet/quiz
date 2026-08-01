using Triviador.Domain.Commands;
using Triviador.Domain.Events;
using Triviador.Domain.Primitives;
using Triviador.Domain.State;

namespace Triviador.Domain.Engine;

public sealed partial class GameEngine
{
    private CommandResult ExecuteJoinGame(JoinGame command)
    {
        if (_state.Phase == GamePhase.Finished)
        {
            return CommandResult.Rejected(RejectionCode.GameAlreadyFinished);
        }

        if (_state.Phase != GamePhase.Lobby)
        {
            return CommandResult.Rejected(RejectionCode.WrongPhase);
        }

        if (_state.Players.Any(p => p.Id == command.PlayerId))
        {
            return CommandResult.Rejected(RejectionCode.PlayerAlreadyJoined);
        }

        if (_state.Players.Count >= _state.Rules.MaxPlayers)
        {
            return CommandResult.Rejected(RejectionCode.RoomFull);
        }

        var player = _state.AddPlayer(command.PlayerId);
        return CommandResult.Accepted(new PlayerJoined(player.Id, player.Seat));
    }

    private CommandResult ExecuteLeaveGame(LeaveGame command)
    {
        if (_state.Phase == GamePhase.Finished)
        {
            return CommandResult.Rejected(RejectionCode.GameAlreadyFinished);
        }

        if (_state.Phase != GamePhase.Lobby)
        {
            return CommandResult.Rejected(RejectionCode.WrongPhase);
        }

        if (!_state.RemovePlayer(command.PlayerId))
        {
            return CommandResult.Rejected(RejectionCode.UnknownPlayer);
        }

        return CommandResult.Accepted(new PlayerLeft(command.PlayerId));
    }

    private CommandResult ExecuteStartGame(StartGame command)
    {
        if (_state.Phase == GamePhase.Finished)
        {
            return CommandResult.Rejected(RejectionCode.GameAlreadyFinished);
        }

        if (_state.Phase != GamePhase.Lobby)
        {
            return CommandResult.Rejected(RejectionCode.WrongPhase);
        }

        if (_state.Players.Count < _state.Rules.MinPlayers)
        {
            return CommandResult.Rejected(RejectionCode.NotEnoughPlayers);
        }

        _state.Phase = GamePhase.BaseSelection;
        var requested = StartBasePick(_state.Players[0].Id, command.At);

        return CommandResult.Accepted(new GameStarted(), requested);
    }

    private BasePickRequested StartBasePick(PlayerId player, Instant at)
    {
        var token = _state.IssueActivityToken();
        var deadline = at.Add(TimeSpan.FromSeconds(_state.Rules.BasePickDurationSeconds));
        _state.Pending = new PendingActivity.BasePick(token, deadline, player);
        return new BasePickRequested(token, player, deadline);
    }
}
