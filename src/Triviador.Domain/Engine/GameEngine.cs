using System.Diagnostics;
using Triviador.Domain.Abstractions;
using Triviador.Domain.Commands;
using Triviador.Domain.Map;
using Triviador.Domain.Primitives;
using Triviador.Domain.State;

namespace Triviador.Domain.Engine;

public sealed partial class GameEngine
{
    private readonly GameState _state;
    private readonly AdjacencyIndex _adjacency;
    private readonly IRandomSource _random;
    private readonly IQuestionSource _questions;

    public GameEngine(GameState state, IRandomSource random, IQuestionSource questions)
    {
        _state = state;
        _adjacency = new AdjacencyIndex(state.Map);
        _random = random;
        _questions = questions;
    }

    public GameState State => _state;

    public CommandResult Execute(IGameCommand command)
    {
        var result = command switch
        {
            JoinGame c => ExecuteJoinGame(c),
            LeaveGame c => ExecuteLeaveGame(c),
            StartGame c => ExecuteStartGame(c),
            SelectBase c => ExecuteSelectBase(c),
            SubmitAnswer c => ExecuteSubmitAnswer(c),
            PickRegion c => ExecutePickRegion(c),
            SelectAttackTarget c => ExecuteSelectAttackTarget(c),
            WithdrawPlayer c => ExecuteWithdrawPlayer(c),
            TimeoutElapsed c => ExecuteTimeoutElapsed(c),
            _ => throw new InvalidOperationException($"Unhandled command type '{command.GetType()}'."),
        };

        AssertInvariant();
        return result;
    }

    [Conditional("DEBUG")]
    private void AssertInvariant()
    {
        // Lobby has no pending activity at all — nobody is waiting on an activity token before the
        // game starts — so the invariant only applies once the game has left Lobby.
        if (_state.Phase == GamePhase.Lobby)
        {
            return;
        }

        Debug.Assert(
            _state.Phase == GamePhase.Finished || _state.Pending is not null,
            "After Execute, the game must be Finished or have a pending activity.");
    }
}
