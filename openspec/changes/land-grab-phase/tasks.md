## 1. Domain: phase, rules, commands, events

- [x] 1.1 Add `GamePhase.LandGrab`.
- [x] 1.2 Add `GameRules` fields: `LandGrabPickDurationSeconds = 10`, `ChoiceQuestionDurationSeconds = 12`,
      `TipQuestionDurationSeconds = 20`, `LandGrabDeadRoundThreshold = 3`.
- [x] 1.3 Add `RejectionCode.RegionNotEligible`.
- [x] 1.4 Add `Commands.SubmitAnswer(Instant At, PlayerId PlayerId, ActivityToken Token, AnswerValue Answer)`
      and `Commands.PickRegion(Instant At, PlayerId PlayerId, ActivityToken Token, RegionId RegionId)`.
- [x] 1.5 Add events: `QuestionAsked(ActivityToken, QuestionPrompt, QuestionPurpose, ImmutableArray<PlayerId> Participants, Instant Deadline)`,
      `AnswerAcknowledged(PlayerId)`, `QuestionResolved(QuestionResult)`,
      `RegionPickRequested(ActivityToken, PlayerId, ImmutableArray<RegionId> EligibleRegionIds, Instant Deadline)`,
      `RegionAwarded(PlayerId, RegionId)`, `LandGrabCompleted`.
- [x] 1.6 Add `GameState.ScoreOf(PlayerId): int` (1000 while holding own base, plus the map `Value` of
      every other owned region) - derived, no stored field, per `IsBase`'s existing precedent.

## 2. Domain: engine wiring

- [x] 2.1 `GameEngine`'s constructor gains `IRandomSource random` and `IQuestionSource questions`
      parameters, stored as fields; update `GameEngine.cs`'s dispatch switch to add
      `SubmitAnswer`/`PickRegion` cases routed to the new partial.
- [x] 2.2 `GameEngine.cs`'s `AssertInvariant`: delete the `awaitingFutureLandGrab` special case; add the
      equivalent one for `Phase == GamePhase.LandGrab && Pending is null`.
- [x] 2.3 New `Engine/GameEngine.LandGrab.cs`:
  - [x] 2.3.1 `StartLandGrab(Instant at): ImmutableArray<IGameEvent>` - sets `Phase = LandGrab`, collects
        all active players as participants, calls `AskLandGrabQuestion` with `DeadRoundCount = 0`.
  - [x] 2.3.2 `AskLandGrabQuestion(ImmutableArray<PlayerId> participants, int deadRoundCount, Instant at)` -
        draws a question via `_questions.Draw(new QuestionDraw(QuestionKindRequest.Any))`, builds
        `TieBreakOrder.Shuffled(participants, _random)`, computes the deadline from the question kind's
        `GameRules` duration, sets `Pending = PendingActivity.Question(...)` with
        `Purpose = QuestionPurpose.LandGrab(deadRoundCount)`, returns a `QuestionAsked` event.
  - [x] 2.3.3 `ExecuteSubmitAnswer(SubmitAnswer command): CommandResult` - validates phase, pending is
        `Question`, token, player is a participant who hasn't already answered (`AlreadyAnswered`);
        records the submission; if every participant has now answered, resolves the question
        (`ResolveQuestion`), otherwise returns just `AnswerAcknowledged`.
  - [x] 2.3.4 `ResolveQuestion(PendingActivity.Question pending, Instant at): ImmutableArray<IGameEvent>` -
        fills in `AnswerValue.None` for any non-respondent, calls `AnswerRanker.Rank`, emits
        `QuestionResolved`; if every submission was `None` (dead round), increments
        `DeadRoundCount` and either re-asks (`AskLandGrabQuestion`) or - at the configured threshold -
        shuffles participants via `_random.Shuffle` and calls `StartAwardQueue` with that order; otherwise
        calls `StartAwardQueue` with the real ranking.
  - [x] 2.3.5 `BuildAwardQueue(ImmutableArray<PlayerId> orderedByRank): ImmutableArray<PlayerId>` - the
        round-robin-interleaved, free-region-count-truncated queue per design.md's algorithm.
  - [x] 2.3.6 `StartAwardQueue(ImmutableArray<PlayerId> orderedByRank, Instant at): ImmutableArray<IGameEvent>` -
        calls `BuildAwardQueue`; if empty (map already full at resolution time), calls
        `CompleteLandGrab`; otherwise sets `Pending = PendingActivity.RegionPicks(...)` and emits
        `RegionPickRequested` for the first queued picker with their freshly computed eligible regions.
  - [x] 2.3.7 `EligibleRegionsFor(PlayerId picker): ImmutableArray<RegionId>` - free regions adjacent (via
        `AdjacencyIndex.NeighborsOf`) to any region the picker owns, falling back to every free region if
        empty. Canonical order: `MapDescriptor.Regions` declaration order.
  - [x] 2.3.8 `ExecutePickRegion(PickRegion command): CommandResult` - validates phase, pending is
        `RegionPicks`, token, player is the queue's current picker, region is free
        (`RegionAlreadyOwned`), region is in `EligibleRegionsFor(picker)` (`RegionNotEligible`); assigns
        ownership, emits `RegionAwarded`, advances `NextIndex`; if the queue is exhausted, checks for a
        full map (`CompleteLandGrab`) or asks the next question (`AskLandGrabQuestion` with
        `DeadRoundCount = 0`); otherwise emits `RegionPickRequested` for the next queued picker with
        freshly computed eligible regions.
  - [x] 2.3.9 `CompleteLandGrab(): ImmutableArray<IGameEvent>` - sets `Pending = null`, returns
        `LandGrabCompleted`.
  - [x] 2.3.10 Extend `ExecuteTimeoutElapsed`'s pending-type switch (`Engine/GameEngine.cs` or a shared
        location) with cases for `PendingActivity.Question` (treat as if every un-answered participant
        submitted `None`, call `ResolveQuestion`) and `PendingActivity.RegionPicks` (auto-pick the current
        picker's first `EligibleRegionsFor` result, or the map's first free region if none, then continue
        exactly like `ExecutePickRegion`'s post-assignment logic).
- [x] 2.4 `Engine/GameEngine.BaseSelection.cs`'s `CompleteBasePick`: when `NextPlayerForBasePick` returns
      `null`, call `StartLandGrab(at)` instead of setting `Pending = null` and emitting only
      `BaseSelectionCompleted` - emit `BaseSelectionCompleted` followed by `StartLandGrab`'s events in the
      same batch.

## 3. Infrastructure: randomness and question content

- [x] 3.1 Add `Triviador.Application.Hosting.IRandomSourceFactory { IRandomSource Create(int seed); }` and
      `Triviador.Application.Content.IQuestionSourceFactory { IQuestionSource Create(int seed); }`.
- [x] 3.2 Add `Triviador.Application.Content.IQuestionRepository` (mirrors `IMapRepository`'s shape):
      exposes every authored question, split by kind.
- [x] 3.3 Author `src/UI/Triviador.Web/Data/questions/questions.json`: ~15 choice questions (id, text,
      4 options, `CorrectOptionIndex`) and ~8 tip questions (id, text, unit, `CorrectNumericValue`).
- [x] 3.4 Add `Triviador.Infrastructure.Content.QuestionRepository : IQuestionRepository` - reads and
      parses the JSON via `IHostEnvironment.ContentRootPath` (mirroring `MapRepository`), validates at
      construction (duplicate ids; choice questions need ≥2 distinct non-empty options and a valid
      `CorrectOptionIndex`; tip questions need a `CorrectNumericValue`), throws with every problem listed
      on failure.
- [x] 3.5 Add `Triviador.Infrastructure.Content.QuestionDealer : IQuestionSource` - built with a seed and
      the repository's questions; shuffles a choice bag and a tip bag (Fisher-Yates, seeded); `Draw`
      picks a kind for `Any` weighted by each bag's remaining count, pops from the front, reshuffles and
      logs a warning on exhaustion.
- [x] 3.6 Add `Triviador.Infrastructure.Content.QuestionSourceFactory : IQuestionSourceFactory` wrapping
      `QuestionDealer` construction.
- [x] 3.7 Add `Triviador.Infrastructure.Hosting.SeededRandomSource : IRandomSource` (seeded
      `System.Random`-backed `NextInt`/`Shuffle`) and `RandomSourceFactory : IRandomSourceFactory`.

## 4. Application: RoomActor and view DTOs

- [x] 4.1 Extend `Contracts/GameViewDto.cs`: `PlayerViewDto` gains `Score: int`; add
      `PendingQuestionViewDto(QuestionPromptDto Prompt, ImmutableArray<Guid> ParticipantPlayerIds, ImmutableDictionary<Guid, bool> HasAnswered, AnswerValueDto? YourAnswer, DateTimeOffset Deadline)`,
      `PendingRegionPickViewDto(Guid CurrentPickerPlayerId, ImmutableArray<string> EligibleRegionIds, DateTimeOffset Deadline)`,
      `LastRevealDto(QuestionPromptDto Prompt, CorrectAnswerDto Correct, ImmutableArray<RevealedAnswerDto> Answers)`;
      add nullable `PendingQuestion`/`PendingRegionPick`/`LastReveal` fields to `GameViewDto`.
- [x] 4.2 Add `SubmitAnswerRequest(Guid RequestingPlayerId, AnswerValueDto Answer, TaskCompletionSource<CommandAck> Reply)`
      and `PickRegionRequest(Guid RequestingPlayerId, string RegionId, TaskCompletionSource<CommandAck> Reply)`
      to `RoomMessage.cs`, following `SelectBaseRequest`'s exact shape.
- [x] 4.3 `RoomActor`: take `IRandomSourceFactory`/`IQuestionSourceFactory`/`IQuestionRepository` (via
      `RoomFactory`) as constructor dependencies; in `HandleStartGameAsync`, generate a 32-bit room seed
      (`RandomNumberGenerator`, matching `GenerateToken`'s pattern) and construct `GameEngine` with
      `randomSourceFactory.Create(seed)` and `questionSourceFactory.Create(seed)`.
- [x] 4.4 `RoomActor`: add `SubmitAnswerAsync`/`PickRegionAsync` public methods (mirroring
      `SelectBaseAsync`) and `HandleSubmitAnswerAsync`/`HandlePickRegionAsync` handlers reusing the
      existing `Execute` -> reject-or-`ArmEngineTimer`-and-broadcast pattern.
- [x] 4.5 `RoomActor.BuildGameView`: extend for `Score`, `PendingQuestion` (secrecy: only the viewer's own
      `AnswerValue` and everyone's boolean `HasAnswered`, never another player's value pre-resolution),
      `PendingRegionPick`.
- [x] 4.6 `RoomActor`: capture the `QuestionResolved` event (if present) from the `Execute` result inside
      `HandleSubmitAnswerAsync`/`HandleEngineTimerElapsedAsync`/`HandlePickRegionAsync`'s underlying
      `Execute` calls, and attach it as `LastReveal` on the one `GameViewDto` broadcast sent immediately
      after that specific command.
- [x] 4.7 Register the new factories/repository port wiring needs in `RoomFactory`.

## 5. Web: hub

- [x] 5.1 Extend `GameHub` with `SubmitAnswer(AnswerValueDto answer)` and `PickRegion(string regionId)`,
      following `SelectBase`'s `ResolveConnection()` + ack + `HubException`-on-rejection pattern.
- [x] 5.2 Register `IQuestionRepository`, `IRandomSourceFactory`, `IQuestionSourceFactory` in `Program.cs`;
      add an eager `app.Services.GetRequiredService<IQuestionRepository>()` alongside the existing map one.

## 6. Client

- [x] 6.1 Extend `contracts.ts`: `GamePhase` gains `'LandGrab'`; add `PendingQuestionView`,
      `PendingRegionPickView`, `LastRevealView` types; extend `GameView` and `PlayerView` (`score`).
- [x] 6.2 Extend `commands.ts` with `submitAnswer`/`pickRegion` wrappers.
- [x] 6.3 Add a `LandGrabScreen`: question panel (choice buttons or a numeric input depending on question
      kind), a countdown to `pendingQuestion.deadline`, per-participant answered/not-answered chips (no
      values shown), a reveal panel rendering `lastReveal` that fades out locally on a timer, and - when
      `pendingRegionPick` is present and the viewer is the current picker - a map highlighting only
      `eligibleRegionIds` as clickable.
- [x] 6.4 Wire `App.tsx`'s phase derivation to show `LandGrabScreen` for `phase === 'LandGrab'`.
- [x] 6.5 Delete `BaseSelectionScreen`'s `baseSelectionComplete` dead-end branch and the
      `GameView.baseSelectionComplete` field it read, now that base selection flows straight into
      `LandGrabScreen`.

## 7. Manual verification

- [x] 7.1 Ran a full "Play vs 3 bots" game (1 human + 3 bots, since bots have no decision-making code
      yet - M6 - every bot seat behaves exactly like an unresponsive human, which is the harder case
      to get right, not an easier stand-in) via Playwright through to completion. **Directly observed,
      live:** land grab started the instant base selection completed (no dead-end screen); choice and
      tip questions both asked via the `Any` draw; correct/incorrect/silent answers all scored and
      ranked; the interleaved `[1st, 2nd, 1st]` award queue observed repeatedly by seeing a player's
      score jump twice (their 2 picks) interleaved with the runner-up's single pick; region ownership
      and scores updated live via `GameViewDto` pushes; the game reached "every region owned" with the
      point math cross-checked exactly (18 regions: 4 bases worth 1000 each + 14 territories' combined
      map value of 3800 = 7800 total across all seats, matching the map's actual value distribution).
      Also ran a separate 2-human room (Alice + Carol, no bots) through base selection and several
      land-grab rounds with both seats under direct control - covers the same mechanics with two real
      humans, cut short by an unrelated browser tab crash (see 7.5).
- [ ] 7.2 A genuine forced tie (two participants scoring identically) was not deliberately reproduced
      live this session - every observed round resolved via a clear correct/incorrect/silent split.
      **Verified by code review instead:** `AnswerRanker`/`TieBreakOrder` are pre-existing, unmodified by
      this change, and already spec-complete (`specs/answer-ranking/spec.md`); this change's only
      involvement is building a fresh `TieBreakOrder.Shuffled` per question (confirmed via an independent
      review pass - never reused stale across questions) and passing it straight to the existing,
      untouched `AnswerRanker.Rank`. There is no new tie-handling code in this change to miss.
- [x] 7.3 Deliberately left questions unanswered (by not acting in time) across several consecutive
      rounds; **directly observed, live, multiple times:** a dead round (all-silent) re-asks a fresh
      question with no award and an incremented dead-round count (reveal panel showed "no answer" for
      every participant, followed immediately by a new question), and after 3 consecutive dead rounds
      the engine auto-awarded territory via the RNG shuffle path instead of asking a 4th time (observed
      a player's score jump with no corresponding correct answer in the preceding reveal).
- [x] 7.4 "Play vs 3 bots": confirmed live, extensively (dozens of instances across two full games) -
      every bot's question timeout (scored as silent, contributing to real rankings and dead rounds
      alike) and every bot's region-pick timeout (auto-picked, preferring a bordering region) resolved
      correctly with zero player action, in both cases advancing the game exactly as a manual action
      would.
- [x] 7.5 Both forms observed live: (a) deliberately slow manual responses repeatedly let a human's own
      question/pick timeout the same way a bot's does, observed directly; (b) an actual browser tab
      crash (unrelated Chrome renderer crash mid-session) took a human seat's connection down entirely
      mid-game. This surfaced a real bug: reconnecting mid-game only re-sent the lobby-shaped
      `RoomViewDto`, never a fresh `GameViewDto`, so a reconnecting client got stuck showing a stale
      lobby screen instead of the in-progress land-grab state. **Fixed** in
      `RoomActor.HandleJoinAsync` (existing-token branch now also pushes a `GameViewDto` to the
      reconnecting connection when `_engine is not null`) and **re-verified live**: reloading a tab
      mid-question now correctly restores the `LandGrab` screen, including the just-resolved question's
      reveal and the current pending region-pick state, on the very next paint.
- [x] 7.6 Observed directly during the completed 4-player game: as free regions thinned out, award
      queues continued to interleave (never handing a runner-up zero picks in favor of the leader
      taking everything remaining) and correctly truncated to however many free regions were left,
      down to the final single-region award that completed the map.
- [x] 7.7 Triggered a live server-side rejection: clicked a region outside the highlighted eligible set
      during an active region-pick turn and got back `HubException: RegionAlreadyOwned`, displayed
      inline in the UI, with the pending activity unchanged afterward (still "Your pick", same
      deadline) - this also caught and fixed a real client bug (see below). The specific
      free-but-non-bordering `RegionNotEligible` rejection was not separately reproduced live (the
      short pick windows made hitting a still-free-but-ineligible region on demand impractical in this
      session), but the code path is structurally identical to the `RegionAlreadyOwned` check just
      proven live (same function, same guard shape) and was independently reviewed line-by-line with no
      defect found. **Bug found and fixed along the way:** `LandGrabScreen.onPickRegion` originally
      short-circuited a click on any region outside `eligibleRegionIds` *client-side*, before ever
      calling the server - meaning `RegionNotEligible` could never actually fire from the UI, unlike
      `BaseSelectionScreen`'s established "server is the only source of legality" precedent. Removed the
      client-side filter; `eligibleRegionIds` now only drives the highlight, and every click reaches the
      server, matching the codebase's own convention.
- [x] 7.8 Observed repeatedly and directly: while a question was open and the local player had answered,
      the UI showed "Answer locked in" for themselves and only name-tagged answered/not-answered chips
      for every other participant - never another participant's submitted value. Only after a question's
      `QuestionResolved`/reveal did any answer value (including the correct one) appear, exactly matching
      the anti-cheat design (`QuestionAsked` carries no answer field on the wire at all).
- [x] 7.9 Confirmed live at the end of the completed 4-player game: once the last free region was
      awarded, every connected client showed "Land grab complete - every region has an owner. The next
      phase isn't built yet - check back soon," the same shape `BaseSelectionScreen`'s old dead-end used
      to be, now one phase later.
- [x] 7.10 `dotnet build` (all 4 .NET projects) and `cd src/Triviador.Client && npx tsc -b --noEmit` both
      clean throughout, re-checked after every layer and again after the reconnect-fix and
      client-eligibility-fix changes found during manual verification.

**Independent review:** a second, fresh agent pass reviewed every new/changed engine file
(`GameEngine.LandGrab.cs`, the `GameEngine.cs`/`GameEngine.BaseSelection.cs` splice points) line-by-line
against the design/spec documents specifically hunting for off-by-one errors in the award-queue
interleaving, an empty-eligible-set crash risk in the timeout auto-pick, dead-round counter bugs, secrecy
leaks, and rejection-precedence violations. No defects were found; two cosmetic non-issues were noted
(a harmless redundant `.OrderBy` and a currently-unreachable defensive branch) and left as-is.
