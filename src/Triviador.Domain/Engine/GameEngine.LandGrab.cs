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
    private static readonly int[] AwardPicksByRank = [2, 1, 0, 0];

    private ImmutableArray<IGameEvent> StartLandGrab(Instant at)
    {
        _state.Phase = GamePhase.LandGrab;
        var participants = ActiveParticipants();
        return AskLandGrabQuestion(participants, deadRoundCount: 0, at);
    }

    private ImmutableArray<PlayerId> ActiveParticipants() =>
        _state.Players.Where(p => !p.Eliminated && !p.Withdrawn).Select(p => p.Id).ToImmutableArray();

    private bool IsActive(PlayerId id)
    {
        var player = _state.Players.FirstOrDefault(p => p.Id == id);
        return player is not null && !player.Eliminated && !player.Withdrawn;
    }

    private ImmutableArray<IGameEvent> AskLandGrabQuestion(ImmutableArray<PlayerId> participants, int deadRoundCount, Instant at)
    {
        var question = _questions.Draw(new QuestionDraw(QuestionKindRequest.Any, _state.BannedCategories));
        var tieBreak = TieBreakOrder.Shuffled(participants, _random);
        var token = _state.IssueActivityToken();
        var durationSeconds = question.Prompt.Kind == QuestionKind.Choice
            ? _state.Rules.ChoiceQuestionDurationSeconds
            : _state.Rules.TipQuestionDurationSeconds;
        var deadline = at.Add(TimeSpan.FromSeconds(durationSeconds));
        var purpose = new QuestionPurpose.LandGrab(deadRoundCount);
        var isGolden = RollGolden();

        _state.Pending = new PendingActivity.Question(
            token, deadline, at, question, purpose, participants,
            ImmutableDictionary<PlayerId, AnswerSubmission>.Empty, tieBreak, isGolden);

        return ImmutableArray.Create<IGameEvent>(new QuestionAsked(token, question.Prompt, purpose, participants, deadline));
    }

    // golden-question's per-game budget/cooldown scheduler: fires a seeded, probabilistic decision
    // once the minimum cooldown of non-golden questions has elapsed, so golden questions land spread
    // out rather than clustered or metronomically regular. A NumericTiebreak question never calls
    // this - it always inherits its Original's flag instead (see AskBattleQuestion).
    private const int GoldenFireChancePercent = 35;

    private bool RollGolden()
    {
        if (!_state.Rules.EnableGoldenQuestion || _state.GoldenQuestionBudget <= 0)
        {
            return false;
        }

        _state.QuestionsSinceLastGolden += 1;
        if (_state.QuestionsSinceLastGolden <= _state.Rules.GoldenQuestionCooldownQuestions)
        {
            return false;
        }

        if (_random.NextInt(0, 100) >= GoldenFireChancePercent)
        {
            return false;
        }

        _state.GoldenQuestionBudget -= 1;
        _state.QuestionsSinceLastGolden = 0;
        return true;
    }

    // Shared by every question-resolution point (land grab, duel, base assault, self-heal, numeric
    // tiebreak) - answer-streaks' single hook. A no-op array when the feature is disabled.
    private ImmutableArray<IGameEvent> ApplyAnswerStreaks(
        ImmutableArray<PlayerId> participants, QuestionResult result, bool isGolden)
    {
        if (!_state.Rules.EnableAnswerStreaks)
        {
            return ImmutableArray<IGameEvent>.Empty;
        }

        var events = ImmutableArray.CreateBuilder<IGameEvent>();
        foreach (var participantId in participants)
        {
            var player = PlayerById(participantId);
            var ranked = result.Rankings.First(r => r.Player == participantId);
            var answeredCorrectly = ranked.Score is { Tier: 0, Penalty: 0 };

            if (!answeredCorrectly)
            {
                player.AnswerStreak = 0;
                continue;
            }

            var priorStreak = player.AnswerStreak;
            player.AnswerStreak = priorStreak + 1;

            var bonus = priorStreak * _state.Rules.AnswerStreakBonusPerStreak;
            if (isGolden)
            {
                bonus *= 2;
            }

            if (bonus > 0)
            {
                player.BonusScore += bonus;
                events.Add(new StreakBonusAwarded(participantId, player.AnswerStreak, bonus));
            }
        }

        return events.ToImmutable();
    }

    private CommandResult ExecuteSubmitAnswer(SubmitAnswer command)
    {
        if (_state.Phase == GamePhase.Finished)
        {
            return CommandResult.Rejected(RejectionCode.GameAlreadyFinished);
        }

        if (_state.Phase is not (GamePhase.LandGrab or GamePhase.Battle))
        {
            return CommandResult.Rejected(RejectionCode.WrongPhase);
        }

        if (_state.Players.All(p => p.Id != command.PlayerId))
        {
            return CommandResult.Rejected(RejectionCode.UnknownPlayer);
        }

        if (_state.Pending is not PendingActivity.Question pending)
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

        if (pending.Submissions.ContainsKey(command.PlayerId))
        {
            return CommandResult.Rejected(RejectionCode.AlreadyAnswered);
        }

        var elapsed = command.At.Since(pending.AskedAt);
        var submission = new AnswerSubmission(command.PlayerId, command.Answer, elapsed);
        var updatedSubmissions = pending.Submissions.SetItem(command.PlayerId, submission);
        var updatedPending = pending with { Submissions = updatedSubmissions };
        _state.Pending = updatedPending;

        var events = ImmutableArray.CreateBuilder<IGameEvent>();
        events.Add(new AnswerAcknowledged(command.PlayerId));

        if (updatedSubmissions.Count >= pending.Participants.Length)
        {
            events.AddRange(ResolveQuestion(updatedPending, command.At));
        }

        return CommandResult.Accepted(events.ToImmutable());
    }

    private ImmutableArray<IGameEvent> ResolveQuestion(PendingActivity.Question pending, Instant at)
    {
        var submissions = pending.Participants
            .Select(p => pending.Submissions.TryGetValue(p, out var s) ? s : new AnswerSubmission(p, AnswerValue.None.Instance, null))
            .ToImmutableArray();

        var result = new QuestionResult(pending.Q, AnswerRanker.Rank(pending.Q, submissions, pending.TieBreak));

        var events = ImmutableArray.CreateBuilder<IGameEvent>();
        events.Add(new QuestionResolved(result));
        if (pending.IsGolden)
        {
            events.Add(new GoldenQuestionRevealed(pending.Token));
        }

        switch (pending.Purpose)
        {
            case QuestionPurpose.LandGrab landGrab:
            {
                events.AddRange(ApplyAnswerStreaks(pending.Participants, result, pending.IsGolden));

                var allSilent = submissions.All(s => s.Answer is AnswerValue.None);
                if (allSilent)
                {
                    var nextDeadRoundCount = landGrab.DeadRoundCount + 1;
                    if (nextDeadRoundCount >= _state.Rules.LandGrabDeadRoundThreshold)
                    {
                        var shuffled = _random.Shuffle(pending.Participants);
                        events.AddRange(StartAwardQueue(shuffled, at, pending.IsGolden));
                    }
                    else
                    {
                        events.AddRange(AskLandGrabQuestion(pending.Participants, nextDeadRoundCount, at));
                    }
                }
                else
                {
                    var orderedByRank = result.Rankings.OrderBy(r => r.Rank).Select(r => r.Player).ToImmutableArray();
                    events.AddRange(StartAwardQueue(orderedByRank, at, pending.IsGolden));
                }

                break;
            }

            case QuestionPurpose.Duel or QuestionPurpose.BaseAssault or QuestionPurpose.NumericTiebreak:
            {
                // Battle's questions don't apply their effect immediately — see
                // GameEngine.Battle.cs's ResolveRevealHold. The reveal is shown first; the region
                // transfer or hit-point damage lands once RevealHold's own deadline elapses. A
                // NumericTiebreak question (asked when a Choice question tied on correctness) gets
                // this same reveal-before-effects treatment — its own RevealHold, then its own
                // ResolveRevealHold case re-dispatches to whichever Duel/BaseAssault effect its
                // Original purpose would have applied.
                var revealToken = _state.IssueActivityToken();
                var revealDeadline = at.Add(TimeSpan.FromSeconds(_state.Rules.RevealHoldDurationSeconds));
                _state.Pending = new PendingActivity.RevealHold(revealToken, revealDeadline, result, pending.Purpose, pending.IsGolden);
                events.Add(new RevealHoldStarted(revealToken, result, revealDeadline));
                break;
            }
        }

        return events.ToImmutable();
    }

    // golden-question doubles the award-queue pick counts (4/2 instead of 2/1) for a golden land-grab
    // question's ranking - see golden-question's "doubles the award queue" scenario.
    private ImmutableArray<PlayerId> BuildAwardQueue(ImmutableArray<PlayerId> orderedByRank, bool golden)
    {
        var multiplier = golden ? 2 : 1;
        var columns = new List<PlayerId>();
        var maxPicks = AwardPicksByRank.Max() * multiplier;

        for (var column = 0; column < maxPicks; column++)
        {
            for (var rankIndex = 0; rankIndex < orderedByRank.Length; rankIndex++)
            {
                var picks = (rankIndex < AwardPicksByRank.Length ? AwardPicksByRank[rankIndex] : 0) * multiplier;
                if (picks > column)
                {
                    columns.Add(orderedByRank[rankIndex]);
                }
            }
        }

        var freeRegionCount = _state.Map.Regions.Count(r => _state.RegionOf(r.Id).OwnerId is null);
        return columns.Take(freeRegionCount).ToImmutableArray();
    }

    private ImmutableArray<IGameEvent> StartAwardQueue(ImmutableArray<PlayerId> orderedByRank, Instant at, bool golden)
    {
        var queue = BuildAwardQueue(orderedByRank, golden);
        if (queue.IsEmpty)
        {
            return CompleteLandGrab(at);
        }

        var token = _state.IssueActivityToken();
        var deadline = at.Add(TimeSpan.FromSeconds(_state.Rules.LandGrabPickDurationSeconds));
        _state.Pending = new PendingActivity.RegionPicks(token, deadline, queue, 0);

        var picker = queue[0];
        var eligible = EligibleRegionsFor(picker);
        return ImmutableArray.Create<IGameEvent>(new RegionPickRequested(token, picker, eligible, deadline));
    }

    public ImmutableArray<RegionId> EligibleRegionsFor(PlayerId picker)
    {
        var freeRegions = _state.Map.Regions.Where(r => _state.RegionOf(r.Id).OwnerId is null).ToImmutableArray();
        var ownedRegionIds = _state.Regions.Where(r => r.OwnerId == picker).Select(r => r.Id).ToImmutableHashSet();

        var bordering = freeRegions
            .Where(r => _adjacency.NeighborsOf(r.Id).Any(ownedRegionIds.Contains))
            .Select(r => r.Id)
            .ToImmutableArray();

        return bordering.Length > 0 ? bordering : freeRegions.Select(r => r.Id).ToImmutableArray();
    }

    private CommandResult ExecutePickRegion(PickRegion command)
    {
        if (_state.Phase == GamePhase.Finished)
        {
            return CommandResult.Rejected(RejectionCode.GameAlreadyFinished);
        }

        if (_state.Phase != GamePhase.LandGrab)
        {
            return CommandResult.Rejected(RejectionCode.WrongPhase);
        }

        if (_state.Players.All(p => p.Id != command.PlayerId))
        {
            return CommandResult.Rejected(RejectionCode.UnknownPlayer);
        }

        if (_state.Pending is not PendingActivity.RegionPicks pending)
        {
            return CommandResult.Rejected(RejectionCode.NotAwaitingThisInput);
        }

        if (command.Token != pending.Token)
        {
            return CommandResult.Rejected(RejectionCode.StaleActivityToken);
        }

        var currentPicker = pending.AwardQueue[pending.NextIndex];
        if (currentPicker != command.PlayerId)
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

        var eligible = EligibleRegionsFor(currentPicker);
        if (!eligible.Contains(command.RegionId))
        {
            return CommandResult.Rejected(RejectionCode.RegionNotEligible);
        }

        return CommandResult.Accepted(CompleteRegionPick(pending, currentPicker, command.RegionId, command.At));
    }

    private ImmutableArray<IGameEvent> CompleteRegionPick(PendingActivity.RegionPicks pending, PlayerId picker, RegionId regionId, Instant at)
    {
        _state.RegionOf(regionId).OwnerId = picker;

        var events = ImmutableArray.CreateBuilder<IGameEvent>();
        events.Add(new RegionAwarded(picker, regionId));
        events.AddRange(AdvanceRegionPickQueue(pending, pending.NextIndex + 1, at));

        return events.ToImmutable();
    }

    // Skips any award-queue entry whose player has since become inactive (withdrawn or eliminated) —
    // a player can be removed from the game while merely queued, not yet current, and their turn must
    // be silently passed over whenever it would otherwise arrive. Also used directly by
    // GameEngine.Withdrawal.cs to reroute past a player withdrawn while they ARE the current picker
    // (startIndex == pending.NextIndex, since no region is awarded for them in that case).
    private ImmutableArray<IGameEvent> AdvanceRegionPickQueue(PendingActivity.RegionPicks pending, int startIndex, Instant at)
    {
        var nextIndex = startIndex;
        while (nextIndex < pending.AwardQueue.Length && !IsActive(pending.AwardQueue[nextIndex]))
        {
            nextIndex++;
        }

        if (nextIndex >= pending.AwardQueue.Length)
        {
            var freeRegionsRemain = _state.Map.Regions.Any(r => _state.RegionOf(r.Id).OwnerId is null);
            return freeRegionsRemain
                ? AskLandGrabQuestion(ActiveParticipants(), 0, at)
                : CompleteLandGrab(at);
        }

        var token = _state.IssueActivityToken();
        var deadline = at.Add(TimeSpan.FromSeconds(_state.Rules.LandGrabPickDurationSeconds));
        var nextPicker = pending.AwardQueue[nextIndex];
        _state.Pending = pending with { Token = token, Deadline = deadline, NextIndex = nextIndex };
        var nextEligible = EligibleRegionsFor(nextPicker);
        return ImmutableArray.Create<IGameEvent>(new RegionPickRequested(token, nextPicker, nextEligible, deadline));
    }

    private ImmutableArray<IGameEvent> CompleteLandGrab(Instant at)
    {
        _state.Pending = null;
        var events = ImmutableArray.CreateBuilder<IGameEvent>();
        events.Add(new LandGrabCompleted());
        events.AddRange(StartBattle(at));
        return events.ToImmutable();
    }

    private ImmutableArray<IGameEvent> TimeoutQuestion(PendingActivity.Question pending, Instant at) =>
        ResolveQuestion(pending, at);

    private ImmutableArray<IGameEvent> TimeoutRegionPick(PendingActivity.RegionPicks pending, Instant at)
    {
        var picker = pending.AwardQueue[pending.NextIndex];
        var eligible = EligibleRegionsFor(picker);
        return CompleteRegionPick(pending, picker, eligible[0], at);
    }
}
