## Context

See proposal.md - Why. The concrete API surface this change integrates against (read directly from
the current codebase, not from the master plan, since parts of the plan's original vision have
already diverged in the implemented architecture):

- `GameEngine(GameState state)` is the only constructor today; `Execute` dispatches
  `JoinGame|LeaveGame|StartGame|SelectBase|TimeoutElapsed` and throws on anything else.
  `AssertInvariant()` special-cases `Phase == BaseSelection && Pending is null` as "awaiting a future
  LandGrab implementation" (`Engine/GameEngine.cs:48-55`) - this change closes that gap and, per the
  same pattern, opens an equivalent one at land grab's own completion (see Decisions).
- `GameEngine.BaseSelection.cs`'s `CompleteBasePick` sets `_state.Pending = null` and emits only
  `BaseSelectionCompleted` when `NextPlayerForBasePick` returns `null` (every base picked) -
  `Engine/GameEngine.BaseSelection.cs:104-113`. This is the exact splice point for starting land grab.
- `GamePhase` is `{ Lobby, BaseSelection, Finished }`; `GameRules` has
  `MinPlayers, MaxPlayers, MinimumBaseDistance, BasePickDurationSeconds, RoundLimit` and no land-grab
  fields. `PlayerState` has `Id, Seat, BaseRegion?, Eliminated` and no `Score` - score is meant to be a
  pure function of state, per the master plan's "no `ScoresChanged` event" convention, and nothing
  computes it anywhere yet.
- `PendingActivity.Question(Token, Deadline, AskedAt, Q, Purpose, Participants, Submissions, TieBreak)`
  and `PendingActivity.RegionPicks(Token, Deadline, AwardQueue, NextIndex)` already exist as data shapes
  (`State/PendingActivity.cs`), declared "so a future change... can freely revise them since no working
  code depends on their exact fields yet." Both shapes match this change's needs as-is.
  `QuestionPurpose.LandGrab(int DeadRoundCount)` also already exists (`State/QuestionPurpose.cs`).
- `Ranking/` (`AnswerEvaluator`, `AnswerRanker`, `TieBreakOrder`, `AnswerSubmission`, `RankedAnswer`,
  `QuestionResult`) is fully implemented and already satisfies `specs/answer-ranking/spec.md` in full.
  `AnswerEvaluator.Evaluate` gracefully scores a shape-mismatched answer (e.g. a `Numeric` answer on a
  `Choice` question) as the worst tier rather than throwing, so `SubmitAnswer` needs no payload-shape
  validation beyond "is this a legal moment to answer" - evaluation happens once, at resolution time.
- `Abstractions/IRandomSource` and `Abstractions/IQuestionSource` are declared interfaces with **zero
  implementations anywhere in the repo**. Land grab is the first caller of both (`TieBreakOrder.Shuffled`
  needs the former; drawing a question needs the latter).
- `Map/AdjacencyIndex` exposes `NeighborsOf(RegionId)` (direct neighbors, for the "must border an owned
  region" rule) and `HopDistance`/`IsWithinHops` (used by base selection's distance rule, not needed
  here).
- `Triviador.Application`: `RoomActor` owns `GameEngine` only from `HandleStartGameAsync` onward; it
  arms one `System.Threading.Timer` per pending activity (`ArmEngineTimer`) and posts
  `EngineTimerElapsed(token)` on expiry, which becomes `TimeoutElapsed`. `GameViewDto`/`PlayerViewDto`/
  `RegionViewDto` (`Contracts/GameViewDto.cs`) carry no score, no pending-question data, no per-player
  answer status - built inline by `RoomActor.BuildGameView`, not by a separate projector class.
  `IMapRepository` is the only content port; there is no `IQuestionRepository`, no room seed, no
  `IRandomSource`/`IQuestionSource` DI registration anywhere.
- `Triviador.Web`: `GameHub` has `StartGame()`/`SelectBase(regionId)` only; `IGameClient` has
  `State`/`GameState`/`RoomClosed`, no reveal-specific push.
- `Triviador.Client`: `contracts.ts`/`commands.ts`/`gameStore.ts` mirror only the lobby/base-selection
  shapes above; `BaseSelectionScreen.tsx` shows "the next phase isn't built yet" once
  `baseSelectionComplete` - this literal message is what this change replaces.

## Goals / Non-Goals

**Goals:**
- Once every base is picked, players answer trivia questions to claim the rest of the map: simultaneous
  timed questions, ranked by the existing kernel, award queue with interleaving and adjacency
  preference, dead-round handling with RNG auto-award, repeating until every region is owned.
- Every player sees a live, secrecy-correct view of an in-flight question (their own answer echoed,
  others' answered/not-answered status only) and of pending region picks (whose turn, eligible regions,
  countdown), and a clear reveal of the resolved question afterward.
- Bots and disconnected humans need no new bot-decision code - the same timeout-driven auto-resolution
  pattern established for base selection (`domain-kernel` + `start-game-and-base-selection`) covers both
  a silent question and an unresponsive region pick.

**Non-Goals:**
- No `RevealHold` pacing. `PendingActivity.RevealHold` stays declared-but-unused (like `TargetSelection`
  and the `Duel`/`BaseAssault` purposes already are) - a resolved question's `QuestionResult` is safe to
  broadcast immediately (the answer is only ever revealed after resolution, never before), so gating the
  next pending activity behind an artificial pause is a pacing/UX nicety, not a secrecy requirement. The
  client fades its own reveal panel locally on a timer. A future change can add real pacing if
  playtesting says results flash by too fast.
- No `Battle`/duel/base-assault phase. When land grab's own award queue empties with the map full,
  `Phase` stays `LandGrab` with `Pending == null` - the same kind of documented, single-instant exception
  `BaseSelection`'s completion used to be (see Decisions). A future change implementing `Battle` closes
  this one exactly as this change closes the previous one.
- No bot decision-making code (`BotBrain`/`BotDriver`, M6) - timeout-driven auto-answer/auto-pick is
  correct and complete for this phase on its own.
- No real question content library (M7's 250 choice + 80 tip target) - a small placeholder bank is
  enough to play a full game and exercise every path; content authoring at scale is separately scoped.
- No dedicated `QuestionContentValidator` type or xUnit test - validation happens inline in
  `QuestionRepository`'s constructor (mirroring `MapRepository`'s existing pattern: validate eagerly,
  throw and kill startup on bad content), consistent with the project's current no-test-projects stance.

## Decisions

**`GameEngine` gains two injected dependencies via its constructor:
`GameEngine(GameState state, IRandomSource random, IQuestionSource questions)`.** Land grab is the first
phase that needs either - shuffling `TieBreakOrder` and drawing a question are both real side-effecting
concerns the engine cannot get from `GameState` alone, and the domain layer's own rule (no ambient
randomness) means they must arrive as constructor dependencies, not statics. Both are threaded through
even though `Lobby`/`BaseSelection` never call them, because a game's `GameEngine` is constructed exactly
once per room (in `RoomActor.HandleStartGameAsync`) and living with two unused-until-later constructor
parameters is simpler than a second constructor or a lazy setter. *Alternative considered:* pass them
per-`Execute`-call instead of at construction - rejected, since every other piece of per-room identity
(the `GameState` itself) is already constructor-scoped, and a "sometimes you pass it, sometimes you
don't" calling convention is worse than two extra constructor arguments used by only some phases.

**A room gets a 32-bit seed at `StartGame` time, not at room creation.** `RoomActor.HandleStartGameAsync`
generates the seed (`RandomNumberGenerator`, matching `GenerateToken`'s existing pattern) right before
constructing `GameEngine`, and uses it to build both the `IRandomSource` and the `IQuestionSource` for
that game. *Rationale:* nothing before `StartGame` needs determinism (the lobby has no randomness), so
generating it earlier would just be dead state carried through the whole lobby phase for no benefit;
generating it at the one moment it's first consumed keeps `RoomActor`'s pre-game state exactly as small
as it is today.

**Two new Application-owned factory ports, implemented in `Triviador.Infrastructure`:**
```csharp
// Triviador.Application/Hosting/IRandomSourceFactory.cs
public interface IRandomSourceFactory { IRandomSource Create(int seed); }
// Triviador.Application/Content/IQuestionSourceFactory.cs
public interface IQuestionSourceFactory { IQuestionSource Create(int seed); }
```
`Triviador.Infrastructure` supplies `SeededRandomSource` (wraps a seeded `System.Random` - banning
`System.Random` only applies to `Triviador.Domain`'s `BannedSymbols.txt`, not Infrastructure, so this is
the correct and only place for it) and `QuestionDealer` (reads all questions via a new
`IQuestionRepository`, splits them into a choice bag and a tip bag, Fisher-Yates-shuffles each with the
seeded source, and pops from the front - reshuffling and logging a warning on exhaustion). *Why a
factory rather than a singleton `IRandomSource`:* the whole reason for seeding is per-room determinism
and replay; a shared singleton instance would let one room's draws perturb another's and would make the
"same seed reproduces the same game" property false. This mirrors `IRoomFactory`'s existing shape
(`Create(roomCode) -> RoomActor`) - the same "factory port in Application, real implementation in
Infrastructure" idiom already used for rooms.

**`IQuestionSource.Draw(QuestionDraw(Any))` picks Choice vs. Tip randomly, weighted by each bag's
remaining size.** Land grab always asks for `Any`. Weighting by remaining count (rather than a fixed
ratio) naturally tracks whatever content ratio is authored without a second tunable, and avoids
exhausting the smaller bag early only to be stuck re-drawing the same kind repeatedly near the end of a
game.

**`Data/questions/questions.json` under `Triviador.Web/Data`, one placeholder file, read by
`QuestionRepository` the same way `MapRepository` reads `map.json`.** ~15 choice + ~8 tip questions -
enough that a full 18-region game (roughly a dozen land-grab questions per the master plan's own
estimate) rarely repeats, without committing to M7's full content-authoring scope. Validated at
construction (duplicate ids, choice questions need ≥2 distinct non-empty options and a valid
`CorrectOptionIndex`, tip questions need a `CorrectNumericValue`) and thrown on failure, eagerly
constructed in `Program.cs` exactly like `IMapRepository` is today - bad content fails startup, never a
player's first question.

**Land-grab-specific `GameRules` fields, no new hardcoded engine constants:**
`LandGrabPickDurationSeconds = 10`, `ChoiceQuestionDurationSeconds = 12`, `TipQuestionDurationSeconds = 20`,
`LandGrabDeadRoundThreshold = 3` (consecutive all-silent rounds before RNG auto-award). Values taken
directly from the master plan's stated durations.

**Award queue: build once per resolved question, round-robin-interleaved, then truncated to free
regions.** `AnswerRanker.Rank` gives a strict `1..n` order; picks-per-rank is `[2, 1, 0, 0]` (fixed at 4
entries, only the first `n` ranks exist for fewer players). The queue is built by round-robin columns
across ranks that still have picks remaining (column 0: every rank with ≥1 pick, in rank order; column 1:
every rank with ≥2 picks; ...) rather than emitting all of one rank's picks before the next - with 2
players this makes no difference, but it's what produces `[1st, 2nd, 1st]` instead of `[1st, 1st, 2nd]`
when only 3 free regions remain (the master plan's own worked example), which matters because the queue
is truncated to `Math.Min(queue.Length, freeRegionCount)` immediately after building it. *Alternative
considered:* emit rank-major (`[1st, 1st, 2nd]`) and truncate - rejected because it's exactly the unfair
tail case the master plan calls out by name.

**Per-picker eligibility is recomputed fresh before every individual pick, not precomputed for the whole
queue.** `EligibleRegionsFor(picker)` = free regions adjacent (`AdjacencyIndex.NeighborsOf`, one hop) to
any region the picker already owns, falling back to every free region if that set is empty. This is
recomputed each time `RegionPickRequested` is about to be emitted (after the previous pick in the same
queue, or after a fresh question), because the previous picker may have just taken the specific region
this picker wanted - a static precomputed list would go stale mid-queue. The event carries the computed
list (`EligibleRegionIds`), so the client never re-derives adjacency and a bot (M6) gets its candidate
set for free, matching the plan's "domain computes legality, ships it in the event" convention already
used nowhere yet but stated as intent.

**Dead rounds: all-`None` triggers a re-ask, not zero-participant awards; three consecutive re-asks
trigger an RNG auto-award.** A question is "dead" when every participant's stored `AnswerSubmission` is
`AnswerValue.None` at resolution (nobody engaged at all, as opposed to everyone answering wrong, which
still ranks and awards normally). On a dead round, `QuestionPurpose.LandGrab.DeadRoundCount` increments
and a fresh question is drawn and asked (same participants, same phase) - no award queue starts. At
`DeadRoundCount == LandGrabDeadRoundThreshold`, instead of asking again, the engine draws a random
permutation of participants via `IRandomSource.Shuffle` and feeds that permutation directly into the
existing award-queue builder as if it were the rank order - reusing one code path for both "ranked by
real answers" and "ranked by RNG" rather than writing a second award mechanism.

**Score is a derived read, not stored state: `GameState.ScoreOf(PlayerId)`.** `1000` while the player
holds their own base (`region.OwnerId == player.Id` for `player.BaseRegion`) plus the map `Value` of
every other region they own - computed on demand from `Regions`/`Players`, matching `IsBase`'s existing
"derived, never stored" precedent exactly. `GameViewDto`'s `PlayerViewDto` gains a `Score` field
populated by calling this at view-build time; there is still no `ScoresChanged` event.

**The per-viewer secrecy split lives in `RoomActor.BuildGameView`, not a new `StateProjector` class.**
Land grab is the first phase with a real secret (another player's in-flight answer value before
resolution), but `BuildGameView` already takes a `viewerId` and already is "the one function that reads
engine state for a client" in practice, even though nothing named `StateProjector` exists. Extending it
in place - adding a nullable `PendingQuestionViewDto` built per-viewer (your own `AnswerValue?` echoed,
everyone else only as `HasAnswered: bool`) - keeps the change additive to the one function that already
owns this job, rather than introducing a second abstraction for a boundary that already has one call
site. *Alternative considered:* extract a standalone `StateProjector` class now, per the master plan's
original design - deferred until a second caller (bots, M6) actually needs to call the same projection
outside of `RoomActor`, per "don't design for hypothetical future requirements."

**`QuestionResolved`'s payload rides along on the very next `GameViewDto` broadcast as a transient
`LastRevealDto`, not as a piece of `GameState`.** `GameState` doesn't retain a resolved question's answers
once `Pending` advances past it (there's nowhere to put them without a second, stale source of truth), so
`RoomActor` captures the `QuestionResolved` event from that specific `Execute` call's result and attaches
its `QuestionResult` (question incl. correct answer, every participant's answer + rank) to the one
`GameViewDto` broadcast sent immediately afterward. Every subsequent broadcast (the next question, a
region-pick request) simply omits `LastReveal`. The client keeps rendering the last reveal it received
until a new `GameViewDto` arrives, then fades it out locally on a short timer - consistent with skipping
`RevealHold` as a Non-Goal above.

**Commands stay minimal, matching `SelectBase`'s existing shape:**
`SubmitAnswer(Instant At, PlayerId PlayerId, ActivityToken Token, AnswerValue Answer)` and
`PickRegion(Instant At, PlayerId PlayerId, ActivityToken Token, RegionId RegionId)`. No `QuestionId` on
`SubmitAnswer` - the `ActivityToken` alone already identifies exactly which question is open, the same
way `SelectBase` needs no separate "which base-pick round" identifier beyond its token. Answer-shape
mismatches (a `Numeric` answer on a `Choice` question) are not rejected at the command level; they simply
evaluate to the worst tier via the existing `AnswerEvaluator`, so no new payload-validation `RejectionCode`
is needed for that case. Two new codes are needed: `RegionNotEligible` (a free region outside the
picker's eligible set when a narrower eligible set exists) and reuse of the already-declared, previously
unused `AlreadyAnswered`.

## Risks / Trade-offs

- [`GameEngine`'s constructor now takes two dependencies unused by two of its three phases] -> Mitigation:
  accepted per the Decisions rationale above; the alternative (a second constructor or optional
  properties) is more surface area for the same one-engine-per-room lifetime.
- [Weighted-by-remaining-count kind selection means the exact choice/tip ratio per game isn't fixed] ->
  Mitigation: acceptable - the master plan's own target ratio (250:80 ≈ 3:1) is what remaining-count
  weighting converges toward anyway when the bags start at that ratio; nothing depends on an exact split.
- [A placeholder ~23-question bank will repeat within one game exercising every path (land grab, plus
  manual replays)] -> Mitigation: explicitly a Non-Goal; `QuestionDealer`'s reshuffle-on-exhaustion logs
  a warning rather than failing, and the shape doesn't change when M7 drops in a bigger `questions.json`.
- [Skipping `RevealHold` means a fast client-side timer, not the engine, decides how long a reveal is
  visible] -> Mitigation: accepted; nothing security-relevant depends on reveal *duration*, only on
  reveal *timing relative to resolution*, which the engine still enforces exactly (the correct answer
  never appears in any event before `QuestionResolved`).
- [`RoomActor.BuildGameView` keeps growing as the one place that knows every phase's secrecy rules] ->
  Mitigation: accepted per the Decisions rationale; revisit extraction once a second caller exists, not
  preemptively.
- [The round-robin award-queue algorithm and the RNG dead-round fallback are the highest-complexity new
  domain code, with no automated test suite to pin them down (per the project's current no-test-projects
  policy)] -> Mitigation: the manual verification checklist below explicitly drives the 14-free-region
  interleaving case and a forced dead-round/auto-award case; this is a real gap worth flagging here even
  if it isn't blocking, since these two algorithms are exactly the kind of "off-by-one in a queue" bug
  that regresses silently without a pinned test.

## Migration Plan

1. `Triviador.Domain`: `GamePhase.LandGrab`; `GameRules` additions; `RejectionCode.RegionNotEligible`;
   `Commands.SubmitAnswer`/`PickRegion`; `Events.QuestionAsked/AnswerAcknowledged/QuestionResolved/
   RegionPickRequested/RegionAwarded/LandGrabCompleted`; `GameEngine`'s constructor gains
   `IRandomSource`/`IQuestionSource`; new `Engine/GameEngine.LandGrab.cs` (`ExecuteSubmitAnswer`,
   `ExecutePickRegion`, the `TimeoutElapsed` cases for `Question`/`RegionPicks`, `StartLandGrab`,
   `AskLandGrabQuestion`, `ResolveQuestion`, `BuildAwardQueue`, `EligibleRegionsFor`,
   `AdvanceOrCompleteLandGrab`); `GameEngine.BaseSelection.cs`'s `CompleteBasePick` calls
   `StartLandGrab` instead of setting `Pending = null` when every base is picked; `GameEngine.cs`'s
   dispatch switch and `AssertInvariant` updated (the `awaitingFutureLandGrab` special case is deleted;
   a new one for `Phase == LandGrab && Pending is null` takes its place); `GameState.ScoreOf(PlayerId)`.
2. `Triviador.Application`: `IRandomSourceFactory`, `IQuestionSourceFactory`, `IQuestionRepository`
   (mirroring `IMapRepository`'s shape); `GameViewDto`/`PlayerViewDto` gain `Score`,
   `PendingQuestionViewDto?`, `PendingRegionPickViewDto?`, `LastRevealDto?`; `RoomActor` gains
   `SubmitAnswerRequest`/`PickRegionRequest` mailbox messages and handlers (reusing the existing
   ack-and-broadcast and `ArmEngineTimer` pattern), a per-room seed generated in
   `HandleStartGameAsync`, and `BuildGameView` extended for the new secrecy-aware fields.
3. `Triviador.Infrastructure`: `SeededRandomSource`/`RandomSourceFactory`, `QuestionRepository`
   (validates at construction, mirroring `MapRepository`), `QuestionDealer`/`QuestionSourceFactory`,
   `Data/questions/questions.json` under `Triviador.Web/Data`.
4. `Triviador.Web`: `GameHub.SubmitAnswer(...)`/`PickRegion(regionId)`; register
   `IQuestionRepository`/`IRandomSourceFactory`/`IQuestionSourceFactory` in `Program.cs`, eager
   `GetRequiredService<IQuestionRepository>()` alongside the existing map one.
5. `Triviador.Client`: `contracts.ts`/`commands.ts` additions (`submitAnswer`, `pickRegion`, the new view
   shapes); a `LandGrabScreen` (question panel with countdown, choice buttons or a numeric input,
   per-participant answered/not-answered chips, a reveal panel that fades locally, then a region-pick UI
   highlighting eligible regions when it's the viewer's pick); `App.tsx`'s phase switch extended;
   `BaseSelectionScreen`'s "next phase isn't built yet" message deleted along with the `baseSelectionComplete`
   dead-end it described (base selection now flows straight into the land-grab screen).
6. Manual verification (repeat until clean, per the project's current no-automated-tests policy):
   - Play a 2-human land grab to completion; confirm ranking/award/pick flow behaves correctly and the
     map ends fully owned.
   - Force a tie (both answer wrong within the same tick, or both timeout) and confirm the shuffled
     tie-break still produces a strict 1st/2nd, not a shared rank.
   - Deliberately answer nothing on several consecutive questions; confirm the dead-round counter re-asks
     up to the threshold, then auto-awards via RNG rather than wedging.
   - "Play vs 3 bots"; confirm every bot's question timeout and region-pick timeout resolve on their own
     with no player action.
   - Disconnect the current human mid-question and mid-pick; confirm both resolve identically to a bot's.
   - Drive the map down to its last 2-3 free regions with 4 active players and confirm the interleaved,
     truncated award queue distributes fairly rather than letting 1st place take every remaining region.
   - Attempt a region pick outside the picker's eligible set when a bordering free region exists; confirm
     rejection with a visible reason, and that it's accepted once no bordering region remains.
   - Confirm via the running client that another player's answer value is never visible before that
     question's `QuestionResolved`/reveal (the project's own secrecy-substring-scan test doesn't exist
     yet without a test project, so this is a manual, deliberate check of the live payloads, not
     automated).
   - Let land grab run to completion (every region owned); confirm every player is shown a clear
     "land grab complete, next phase isn't built yet" state, exactly the shape `BaseSelectionScreen`'s
     old dead-end used to be, now one phase later.
7. `dotnet build` and `npx tsc -b --noEmit` clean throughout.

**Rollback:** additive to `RoomActor`/`GameHub`/client and new Domain/Infrastructure files; the one
non-additive edit is `GameEngine.BaseSelection.cs`'s `CompleteBasePick` branch and `GameEngine.cs`'s
`AssertInvariant`, both small and easily reverted to restore the exact prior "stops at BaseSelection"
behavior if needed.

## Open Questions

- Whether the placeholder question bank's topic/difficulty metadata should exist at all yet, given M7
  owns real content authoring - resolved for this change as "no", a bare `id/kind/text/options/answer`
  shape is enough to play; topic anti-clumping and difficulty are explicitly later scope.
- Whether `RoomActor.BuildGameView`'s continued growth eventually forces the `StateProjector` extraction
  the master plan originally envisioned - deliberately left open per the Decisions rationale (extract
  when a second caller needs it, not before).
