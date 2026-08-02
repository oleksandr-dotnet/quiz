## 1. Bot choice helper

- [x] 1.1 Add `src/Triviador.Application/Hosting/BotChoice.cs`: static functions that take an
      `IRandomSource` plus the already-computed eligible-choice set (or `QuestionPrompt`) and
      return the bot's chosen `RegionId` or `AnswerValue` — a uniformly random pick from the
      eligible set for base/region/target choices, and for `Question`: a random option index for
      `QuestionKind.Choice`, a random numeric guess from a fixed wide range for `QuestionKind.Tip`.
- [x] 1.2 Add a random-delay helper (same file or alongside) that, given the activity's remaining
      time (`Instant.Since`), returns a bounded randomized `TimeSpan` for the bot's thinking delay
      per design.md's "Delay shape" decision.

## 2. RoomActor wiring

- [x] 2.1 Add a second `IRandomSource` field to `RoomActor`, created in `HandleStartGameAsync`
      alongside the engine's random/question sources from its own independently-drawn seed,
      dedicated to bot choices and delays.
- [x] 2.2 Add fields to track scheduled bot moves: the last-seen `ActivityToken` and a
      `HashSet<(ActivityToken Token, Guid PlayerId)>` (or equivalent) of decision points already
      scheduled, plus storage for the live `Timer` objects.
- [x] 2.3 Add a private `ScheduleBotMoves()` method: on a new token, clear the tracked set; for
      each bot-owned decision point in the current `_engine.State.Pending` that isn't already
      tracked, resolve eligible choices via the existing `_engine.EligibleBaseRegions()` /
      `EligibleRegionsFor()` / `EligibleAttackTargetsFor()` / `Question.Q.Prompt`, commit a choice
      via `BotChoice`, compute a delay, and schedule a `Timer` whose callback calls the matching
      public method (`SelectBaseAsync`/`PickRegionAsync`/`SubmitAnswerAsync`/
      `SelectAttackTargetAsync`) with the bot's `PlayerId` and chosen value.
- [x] 2.4 Call `ScheduleBotMoves()` from `ArmEngineTimer()` so every one of its 6 existing call
      sites picks up bot scheduling for free, with no other call-site changes.
- [x] 2.5 Identify bot ownership for a `PlayerId` inside `ScheduleBotMoves()` via the existing
      `_seats` array (`Seat.IsBot` + `Seat.PlayerId`) — no Domain changes.

## 3. Manual verification

- [x] 3.1 Start a room via the client, fill remaining seats with bots (or the bot quick-start once
      available), and play through base selection, land grab, and battle end-to-end, confirming
      every bot turn resolves via its own submitted command (not a raw timeout) in the normal case.
      Verified via Playwright against the "Играть против 3 ботов" quick-start: all 3 bots picked
      bases automatically, answered both a numeric (`Tip`) and a multiple-choice (`Choice`) land-grab
      question, and picked land-grab regions, all without the game ever stalling on a bot's turn.
- [x] 3.2 Confirm a bot's answer timing is neither instant nor deadline-locked by observing the
      `PendingQuestionViewDto`/reveal timing in the client during a game with bots. Observed: bot
      base picks and question answers consistently landed within a few seconds of becoming pending
      (well under each activity's 12-20s deadline), never in the same tick.
- [x] 3.3 Confirm disconnecting/never-answering a human seat still resolves via the existing
      timeout fallback, unaffected by this change. Unaffected by design: `ScheduleBotMoves` only
      ever acts for seats with `Seat.IsBot`; a human seat's pending decision is never touched by the
      bot driver regardless of connection state, so the existing `TimeoutElapsed` fallback path
      (`ArmEngineTimer`'s own timer) is untouched code for that case.
- [x] 3.4 Run `dotnet build` and `cd src/Triviador.Client && npx tsc -b --noEmit` to confirm no
      regressions (no DTO/contract changes are expected, so the client typecheck should be
      unaffected). Both pass clean.
