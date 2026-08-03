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
            if (player is null || player.Eliminated || player.Withdrawn)
            {
                continue;
            }

            var eligible = EligibleAttackTargetsFor(next);
            if (eligible.IsEmpty)
            {
                events.Add(new TurnSkipped(next));
                continue;
            }

            events.AddRange(IssueTargetSelection(next, eligible, at));
            return events.ToImmutable();
        }
    }

    private ImmutableArray<IGameEvent> IssueTargetSelection(PlayerId player, ImmutableArray<RegionId> eligible, Instant at)
    {
        var token = _state.IssueActivityToken();
        var deadline = at.Add(TimeSpan.FromSeconds(_state.Rules.AttackTargetSelectionDurationSeconds));
        _state.Pending = new PendingActivity.TargetSelection(token, deadline, player);
        return ImmutableArray.Create<IGameEvent>(new AttackTargetRequested(token, player, eligible, deadline));
    }

    // Offers the same player another target selection without consuming a RoundQueue slot — used
    // when a self-heal succeeds and the healer keeps their turn (they may heal again, or now attack,
    // in the same turn). EligibleAttackTargetsFor is re-derived fresh, so a now-fully-healed base
    // naturally drops out of the offer. If nothing is left to do (fully healed, no adjacent enemy),
    // the turn simply ends via AdvanceTurn rather than a TurnSkipped — the player already acted this
    // turn, they just have nothing left to spend it on.
    private ImmutableArray<IGameEvent> ContinueTurnFor(PlayerId player, Instant at)
    {
        var eligible = EligibleAttackTargetsFor(player);
        return eligible.IsEmpty ? AdvanceTurn(at) : IssueTargetSelection(player, eligible, at);
    }

    // Canonical order: MapDescriptor.Regions declaration order, matching EligibleRegionsFor's
    // existing precedent. Public for the same reason EligibleRegionsFor is — RoomActor recomputes
    // this fresh for every view broadcast rather than trusting a stored snapshot.
    public ImmutableArray<RegionId> EligibleAttackTargetsFor(PlayerId attacker)
    {
        var ownedRegionIds = _state.Regions.Where(r => r.OwnerId == attacker).Select(r => r.Id).ToImmutableHashSet();
        var baseAssaultsUnlocked = BaseAssaultsUnlocked();

        var enemyTargets = _state.Map.Regions
            .Where(rd =>
            {
                var ownerId = _state.RegionOf(rd.Id).OwnerId;
                if (ownerId is null || ownerId == attacker) return false;
                if (!_adjacency.NeighborsOf(rd.Id).Any(ownedRegionIds.Contains)) return false;
                return baseAssaultsUnlocked || !_state.IsBase(rd.Id);
            })
            .Select(rd => rd.Id);

        var self = PlayerById(attacker);
        // A player may spend their turn shoring up their own damaged base instead of attacking
        // someone else's — a self-heal that keeps chaining on every correct answer (see
        // ResolveRevealHold). Only offered once base assaults are unlocked (the same threshold
        // governing every other base target) and only while damaged, so it never appears as a no-op
        // option.
        var selfHealTarget = baseAssaultsUnlocked && self.BaseRegion is not null && self.BaseHitPoints < _state.Rules.BaseHitPointsDefault
            ? ImmutableArray.Create(self.BaseRegion.Value)
            : ImmutableArray<RegionId>.Empty;

        return enemyTargets.Concat(selfHealTarget).ToImmutableArray();
    }

    // Capitals are only assaultable from a fixed round onward (GameRules.BaseAssaultUnlockRound,
    // round 8 by default) — a fixed threshold independent of RoundLimit/ruleset, so early rounds
    // stay about grabbing regular territory instead of rushing straight for an elimination.
    private bool BaseAssaultsUnlocked() => _state.CurrentRound >= _state.Rules.BaseAssaultUnlockRound;

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
        // A self-heal (attacker targeting their own base) has exactly one participant — a duplicate
        // two-element array here would break every consumer that keys off Participants by PlayerId
        // (e.g. RoomActor's per-participant hasAnswered dictionary).
        var participants = attacker == defender
            ? ImmutableArray.Create(attacker)
            : ImmutableArray.Create(attacker, defender);

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
                // A duel where neither side answered correctly is not an attacker win by rank alone
                // — the territory stays put rather than changing hands on two wrong guesses. A
                // withdrawn attacker (host-kicked with territory release, during this reveal window)
                // never receives new territory either, regardless of how the question resolved.
                if (!PlayerById(duel.Attacker).Withdrawn
                    && !BothAnsweredIncorrectly(pending.Result, duel.Attacker, duel.Defender)
                    && AttackerWon(pending.Result, duel.Attacker, duel.Defender))
                {
                    _state.RegionOf(duel.Region).OwnerId = duel.Attacker;
                    events.Add(new RegionCaptured(duel.Attacker, duel.Defender, duel.Region));
                }

                var ended = CheckEndConditions();
                events.AddRange(ended ?? AdvanceTurn(at));
                break;
            }

            case QuestionPurpose.BaseAssault assault when assault.Attacker == assault.Defender:
            {
                // Self-heal: success heals rather than damages, and — unlike a lost self-heal —
                // keeps the turn. AttackerWon can't apply here — it compares the attacker's and
                // defender's ranks, which are the same single ranked answer when attacker ==
                // defender, so it would always evaluate to "attacker did not win". Correctness is
                // instead read straight off that one ranked answer: Tier 0 means an exactly-right
                // Choice answer; for a Tip (numeric) answer, Penalty (the absolute distance from the
                // correct value) must also be exactly 0, since numeric answers are otherwise ranked
                // by closeness, not exactness, and "closer than no one" isn't a meaningful heal
                // condition.
                var score = pending.Result.Rankings.First(r => r.Player == assault.Attacker).Score;
                var healed = !PlayerById(assault.Attacker).Withdrawn && score is { Tier: 0, Penalty: 0 };
                if (healed)
                {
                    var self = PlayerById(assault.Attacker);
                    self.BaseHitPoints = Math.Min(self.BaseHitPoints + 1, _state.Rules.BaseHitPointsDefault);
                    events.Add(new BaseHitPointsChanged(assault.Attacker, self.BaseHitPoints));
                }

                // A correct heal keeps the turn — the healer may heal again (if still damaged) or
                // now attack, all in the same turn. An incorrect/inexact/missed answer ends the turn
                // exactly as before.
                events.AddRange(healed ? ContinueTurnFor(assault.Attacker, at) : AdvanceTurn(at));
                break;
            }

            case QuestionPurpose.BaseAssault assault:
            {
                // A withdrawn attacker (host-kicked with territory release, during this reveal
                // window) never receives a hit-point win or a capture either, regardless of how the
                // question resolved — treated the same as a defender win below.
                if (!PlayerById(assault.Attacker).Withdrawn && AttackerWon(pending.Result, assault.Attacker, assault.Defender))
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
                        // No fixed per-turn cap on the chain: the attacker keeps facing fresh
                        // questions against this same base for as long as they keep winning, ending
                        // only when hit points reach zero (captured, above) or a tie/defender-win
                        // stops the chain (below). QuestionIndex/DamageDealtThisTurn still advance
                        // for anyone inspecting the purpose (e.g. a view/event consumer).
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

    private static bool BothAnsweredIncorrectly(QuestionResult result, PlayerId attacker, PlayerId defender)
    {
        var attackerTier = result.Rankings.First(r => r.Player == attacker).Score.Tier;
        var defenderTier = result.Rankings.First(r => r.Player == defender).Score.Tier;
        return attackerTier > 0 && defenderTier > 0;
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
