using System.Collections.Immutable;
using Triviador.Domain.Commands;
using Triviador.Domain.Events;
using Triviador.Domain.Primitives;
using Triviador.Domain.Questions;
using Triviador.Domain.Ranking;
using Triviador.Domain.State;

namespace Triviador.Domain.Engine;

public sealed partial class GameEngine
{
    private ImmutableArray<IGameEvent> StartBattle(Instant at)
    {
        _state.Phase = GamePhase.Battle;
        _state.RoundQueue = ImmutableQueue<PlayerId>.Empty;
        _state.CurrentRound = 0;
        return AdvanceTurn(at);
    }

    // Dequeues the next player's turn, rebuilding the queue (and advancing the round counter) from
    // whoever is active right now whenever it runs dry. Skips eliminated players and players with no
    // legal target lazily, so a whole dead round (nobody can attack anybody) still terminates: it
    // rebuilds, checks end conditions, and — if the round limit is reached — ends the game instead of
    // spinning forever.
    private ImmutableArray<IGameEvent> AdvanceTurn(Instant at)
    {
        var events = ImmutableArray.CreateBuilder<IGameEvent>();

        while (true)
        {
            if (_state.RoundQueue.IsEmpty)
            {
                var active = ActiveParticipants();
                _state.RoundQueue = ImmutableQueue.CreateRange(active);
                _state.CurrentRound += 1;
                events.Add(new RoundAdvanced(_state.CurrentRound));

                var ended = CheckEndConditions();
                if (ended is not null)
                {
                    events.AddRange(ended);
                    return events.ToImmutable();
                }
            }

            var next = _state.RoundQueue.Peek();
            _state.RoundQueue = _state.RoundQueue.Dequeue();

            var player = _state.Players.FirstOrDefault(p => p.Id == next);
            if (player is null || player.Eliminated)
            {
                continue;
            }

            var eligible = EligibleAttackTargetsFor(next);
            if (eligible.IsEmpty)
            {
                events.Add(new TurnSkipped(next));
                continue;
            }

            var token = _state.IssueActivityToken();
            var deadline = at.Add(TimeSpan.FromSeconds(_state.Rules.AttackTargetSelectionDurationSeconds));
            _state.Pending = new PendingActivity.TargetSelection(token, deadline, next);
            events.Add(new AttackTargetRequested(token, next, eligible, deadline));
            return events.ToImmutable();
        }
    }

    // Canonical order: MapDescriptor.Regions declaration order, matching EligibleRegionsFor's
    // existing precedent. Public for the same reason EligibleRegionsFor is — RoomActor recomputes
    // this fresh for every view broadcast rather than trusting a stored snapshot.
    public ImmutableArray<RegionId> EligibleAttackTargetsFor(PlayerId attacker)
    {
        var ownedRegionIds = _state.Regions.Where(r => r.OwnerId == attacker).Select(r => r.Id).ToImmutableHashSet();

        return _state.Map.Regions
            .Where(rd =>
            {
                var ownerId = _state.RegionOf(rd.Id).OwnerId;
                return ownerId is not null && ownerId != attacker && _adjacency.NeighborsOf(rd.Id).Any(ownedRegionIds.Contains);
            })
            .Select(rd => rd.Id)
            .ToImmutableArray();
    }

    private CommandResult ExecuteSelectAttackTarget(SelectAttackTarget command)
    {
        if (_state.Phase == GamePhase.Finished)
        {
            return CommandResult.Rejected(RejectionCode.GameAlreadyFinished);
        }

        if (_state.Phase != GamePhase.Battle)
        {
            return CommandResult.Rejected(RejectionCode.WrongPhase);
        }

        if (_state.Players.All(p => p.Id != command.PlayerId))
        {
            return CommandResult.Rejected(RejectionCode.UnknownPlayer);
        }

        if (_state.Pending is not PendingActivity.TargetSelection pending)
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

        if (!_state.Map.Regions.Any(r => r.Id == command.TargetRegionId))
        {
            return CommandResult.Rejected(RejectionCode.UnknownRegion);
        }

        var eligible = EligibleAttackTargetsFor(command.PlayerId);
        if (!eligible.Contains(command.TargetRegionId))
        {
            return CommandResult.Rejected(RejectionCode.RegionNotEligible);
        }

        return CommandResult.Accepted(StartBattleQuestion(command.PlayerId, command.TargetRegionId, command.At));
    }

    private ImmutableArray<IGameEvent> StartBattleQuestion(PlayerId attacker, RegionId targetRegionId, Instant at)
    {
        var defender = _state.RegionOf(targetRegionId).OwnerId!.Value;
        QuestionPurpose purpose = _state.IsBase(targetRegionId)
            ? new QuestionPurpose.BaseAssault(attacker, defender, targetRegionId, QuestionIndex: 0, DamageDealtThisTurn: 0)
            : new QuestionPurpose.Duel(attacker, defender, targetRegionId);

        return AskBattleQuestion(purpose, attacker, defender, at);
    }

    private ImmutableArray<IGameEvent> AskBattleQuestion(QuestionPurpose purpose, PlayerId attacker, PlayerId defender, Instant at)
    {
        var question = _questions.Draw(new QuestionDraw(QuestionKindRequest.Any));
        // The defender is always placed first, so a tie (including a double-timeout, where both
        // submissions are AnswerValue.None) is always won by the defender.
        var tieBreak = TieBreakOrder.Prefer(defender, attacker);
        var token = _state.IssueActivityToken();
        var durationSeconds = question.Prompt.Kind == QuestionKind.Choice
            ? _state.Rules.ChoiceQuestionDurationSeconds
            : _state.Rules.TipQuestionDurationSeconds;
        var deadline = at.Add(TimeSpan.FromSeconds(durationSeconds));
        var participants = ImmutableArray.Create(attacker, defender);

        _state.Pending = new PendingActivity.Question(
            token, deadline, at, question, purpose, participants,
            ImmutableDictionary<PlayerId, AnswerSubmission>.Empty, tieBreak);

        return ImmutableArray.Create<IGameEvent>(new QuestionAsked(token, question.Prompt, purpose, participants, deadline));
    }

    private ImmutableArray<IGameEvent> TimeoutTargetSelection(PendingActivity.TargetSelection pending, Instant at)
    {
        // Nothing else can change region ownership while a single player's TargetSelection is the
        // sole pending activity, so this can never be empty here — AdvanceTurn only ever creates one
        // when EligibleAttackTargetsFor is already non-empty.
        var eligible = EligibleAttackTargetsFor(pending.Player);
        return StartBattleQuestion(pending.Player, eligible[0], at);
    }

    // The only legal input against a RevealHold (see game-setup-rules' Battle-phase legal-commands
    // requirement) — applies whatever the just-resolved question decided, now that the reveal window
    // has elapsed, then continues the turn/round machinery.
    private ImmutableArray<IGameEvent> ResolveRevealHold(PendingActivity.RevealHold pending, Instant at)
    {
        var events = ImmutableArray.CreateBuilder<IGameEvent>();

        switch (pending.Purpose)
        {
            case QuestionPurpose.Duel duel:
            {
                if (AttackerWon(pending.Result, duel.Attacker, duel.Defender))
                {
                    _state.RegionOf(duel.Region).OwnerId = duel.Attacker;
                    events.Add(new RegionCaptured(duel.Attacker, duel.Defender, duel.Region));
                }

                var ended = CheckEndConditions();
                events.AddRange(ended ?? AdvanceTurn(at));
                break;
            }

            case QuestionPurpose.BaseAssault assault:
            {
                if (AttackerWon(pending.Result, assault.Attacker, assault.Defender))
                {
                    var defender = PlayerById(assault.Defender);
                    defender.BaseHitPoints -= 1;
                    events.Add(new BaseHitPointsChanged(assault.Defender, defender.BaseHitPoints));

                    if (defender.BaseHitPoints <= 0)
                    {
                        events.AddRange(CaptureBase(assault.Attacker, assault.Defender, assault.BaseRegion));
                        var ended = CheckEndConditions();
                        events.AddRange(ended ?? AdvanceTurn(at));
                    }
                    else
                    {
                        // Base HP starts at GameRules.BaseHitPointsDefault (3) and never regenerates,
                        // so it can never exceed 3 here — the rule's "up to 3 questions" cap is
                        // automatically satisfied by "keep going until HP hits 0", with no separate
                        // counter needed. QuestionIndex/DamageDealtThisTurn still advance for anyone
                        // inspecting the purpose (e.g. a future view/event consumer).
                        var nextPurpose = assault with
                        {
                            QuestionIndex = assault.QuestionIndex + 1,
                            DamageDealtThisTurn = assault.DamageDealtThisTurn + 1,
                        };
                        events.AddRange(AskBattleQuestion(nextPurpose, assault.Attacker, assault.Defender, at));
                    }
                }
                else
                {
                    // Defender won (or the rare double-timeout tie, which the defender-preferred
                    // tie-break also resolves as a defender win) — the assault ends immediately,
                    // retaining whatever hit points were already lost earlier this turn.
                    events.AddRange(AdvanceTurn(at));
                }

                break;
            }
        }

        return events.ToImmutable();
    }

    private static bool AttackerWon(QuestionResult result, PlayerId attacker, PlayerId defender)
    {
        var attackerRank = result.Rankings.First(r => r.Player == attacker).Rank;
        var defenderRank = result.Rankings.First(r => r.Player == defender).Rank;
        return attackerRank < defenderRank;
    }

    private PlayerState PlayerById(PlayerId id) => _state.Players.First(p => p.Id == id);

    // Order matters: transfer every region the defender owns before flipping Eliminated, so
    // ownership-filtering helpers (ActiveParticipants, EligibleAttackTargetsFor) never see the
    // defender as already-eliminated mid-transfer and silently skip regions that still need to move.
    private ImmutableArray<IGameEvent> CaptureBase(PlayerId attacker, PlayerId defenderId, RegionId baseRegionId)
    {
        var transferred = _state.Regions.Where(r => r.OwnerId == defenderId).Select(r => r.Id).ToImmutableArray();
        foreach (var regionId in transferred)
        {
            _state.RegionOf(regionId).OwnerId = attacker;
        }

        PlayerById(defenderId).Eliminated = true;

        return ImmutableArray.Create<IGameEvent>(
            new BaseCaptured(attacker, defenderId, baseRegionId, transferred),
            new PlayerEliminated(defenderId));
    }

    // The single choke point every Battle mutation that could end the game routes through: called
    // after a round-rollover (round-limit path) and after a base capture/elimination (last-player-
    // standing path). Returns null when the game continues.
    private ImmutableArray<IGameEvent>? CheckEndConditions()
    {
        var active = ActiveParticipants();
        if (active.Length <= 1)
        {
            return FinishGame(active);
        }

        if (_state.CurrentRound > _state.Rules.RoundLimit)
        {
            var topScore = active.Max(id => _state.ScoreOf(id));
            var winners = active.Where(id => _state.ScoreOf(id) == topScore).ToImmutableArray();
            return FinishGame(winners);
        }

        return null;
    }

    private ImmutableArray<IGameEvent> FinishGame(ImmutableArray<PlayerId> winners)
    {
        _state.Phase = GamePhase.Finished;
        _state.Outcome = new GameOutcome(winners);
        _state.Pending = null;
        return ImmutableArray.Create<IGameEvent>(new BattleCompleted(), new GameFinished(_state.Outcome));
    }
}
