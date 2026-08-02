## Context

`RoomActor` (`src/Triviador.Application/Hosting/RoomActor.cs`) is a single-mailbox actor: every
command flows through one `Channel<RoomMessage>` and one pump task, so state is touched by exactly
one logical thread. A bot seat (`Seat.IsBot`) is given a real `PlayerId` in `HandleStartGameAsync`
and from that point on `GameEngine`/`GameState` cannot tell it apart from a human's `PlayerId` —
the engine has no bot concept at all, by design (see CLAUDE.md).

Every decision point the engine can be waiting on is one of the `PendingActivity` subtypes
(`BasePick`, `RegionPicks`, `TargetSelection`, `Question`, `RevealHold`). `RoomActor` already knows,
for each of these, exactly who needs to act and what their eligible choices are — it computes this
today purely to build `BuildGameView`'s `PendingXxxViewDto` family
(`_engine.EligibleBaseRegions()`, `_engine.EligibleRegionsFor(picker)`,
`_engine.EligibleAttackTargetsFor(player)`, `question.Q.Prompt.Options`). Today, if the acting
player is a bot, none of `RoomActor`'s public command methods (`SelectBaseAsync`,
`PickRegionAsync`, `SubmitAnswerAsync`, `SelectAttackTargetAsync`) are ever called for it, so the
activity just sits until `ArmEngineTimer`'s deadline fires `TimeoutElapsed`.

`ArmEngineTimer()` is called after every accepted command and after every `TimeoutElapsed`
(6 call sites) — it is already the place `RoomActor` re-derives "what should happen next" from
`_engine.State.Pending`. It's the natural single hook for also re-deriving "does a bot need to act
next, and if so, when and with what."

An important subtlety: `AnswerRanker` (`src/Triviador.Domain/Ranking/AnswerRanker.cs`) breaks ties
between equally-scored answers by `Elapsed` (submission time since the question was asked) before
falling back to `TieBreakOrder`. So a bot's answer timing is not cosmetic — an instant bot answer
would win every elapsed-time tie against slower humans, and an answer that always waits for the
deadline would lose every such tie. A human-like randomized delay is a correctness-adjacent
behavior, not just polish.

## Goals / Non-Goals

**Goals:**
- Every `PendingActivity` whose acting player is a bot eventually gets a command submitted for it,
  through the exact same `RoomActor` public methods and the exact same anti-cheat-safe information
  a human client would have (no reading `Question.CorrectOptionIndex`/`CorrectNumericValue`,
  no reading `GameState` directly).
- Bot timing looks human-like: neither instant nor deadline-locked, and never past the deadline
  (the existing `TimeoutElapsed` fallback remains the backstop it already is).
- Zero changes to `Triviador.Domain` — no `IsBot`/`PlayerType` on `PlayerState`, no bot-awareness
  in `GameEngine`.
- Reuse the existing stale-token rejection path (`RejectionCode.StaleActivityToken`,
  `NotAwaitingThisInput`, `NotYourTurn`) as the safety net for races between a bot's scheduled move
  and a state change that happened first (a human acting, a timeout firing) — the same way the
  engine already treats a stale `TimeoutElapsed` as a harmless no-op.

**Non-Goals:**
- Bots are not "smart" — no attempt to weight choices by any notion of a good move (best base,
  best target, likely-correct answer). A uniformly random eligible choice is intentional: bots are
  meant to be playable opponents that keep the game moving, not a difficulty tier.
- No calibration of numeric ("Tip") guesses to a question's plausible range — `QuestionPrompt`
  deliberately carries no bounds/hint metadata, so a bot's numeric guess is a plain random draw
  from a fixed wide range, same blind-guess information level a first-time human has.
- No bot-specific UI/DTO changes — bots remain invisible as an implementation detail; the client
  already renders bot seats identically to human ones.

## Decisions

### 1. Reuse the existing command methods, don't add a bot-only code path
A bot's scheduled move calls `SelectBaseAsync`/`PickRegionAsync`/`SubmitAnswerAsync`/
`SelectAttackTargetAsync` on `RoomActor` itself — the same methods `GameHub` calls for a human,
just invoked in-process instead of over SignalR. This gets full validation (right phase, right
turn, right token, region ownership rules, etc.) for free and guarantees a bot can never do
anything a human couldn't. Rejected alternative: giving the bot driver direct access to
`_engine.Execute(...)` — this would duplicate every validation branch already in
`Handle*Async` and risks the bot bypassing a rule check by accident.

### 2. Bot choice-picking lives in a small pure helper, not inline in `RoomActor`
New file `src/Triviador.Application/Hosting/BotChoice.cs`: static functions taking eligible
options (already computed the same way `BuildGameView` computes them) plus an `IRandomSource`,
returning a `RegionId` or `AnswerValue`. `RoomActor` stays the orchestrator (who/when); `BotChoice`
is the decision (what). This keeps the one already-large `RoomActor` file from absorbing
guess-shaping logic, and makes the decision logic trivially readable in isolation even without a
test project.

### 3. One dedicated `IRandomSource` per room for bot decisions, separate from the engine's
`HandleStartGameAsync` already draws a crypto-random seed for the engine's own
`IRandomSourceFactory.Create(seed)` (land-grab shuffles, tie-break order, question deck). A second
seed/`IRandomSource` is drawn the same way, dedicated to bot choices and thinking-delay durations.
Kept separate from the engine's random source so bot behavior can never perturb the engine's own
draw sequence (which is part of what makes a game replayable from `(seed, command log)`) — the bot
driver only ever produces already-realized commands, which are what actually gets logged/replayed.
Rejected alternative: sharing the engine's `IRandomSource` — works, but couples an
Application-layer concern to a Domain-owned random stream for no benefit, and would require passing
the engine's random source out of the engine.

### 4. Scheduling hook: fold into `ArmEngineTimer`, keyed on `(ActivityToken, PlayerId)`
Rename the existing re-arm step's role slightly: after computing the engine's own deadline timer,
`ArmEngineTimer` also calls a new `ScheduleBotMoves()`. This avoids touching all 6 call sites
individually.

`ScheduleBotMoves()` tracks the set of `(ActivityToken, Guid PlayerId)` pairs it has already
scheduled a bot `Timer` for. On each call:
- If `_engine.State.Pending`'s token differs from the last-seen token, the room has moved to a
  brand-new turn (`BasePick`/`RegionPicks`/`TargetSelection` all issue a fresh `ActivityToken` per
  turn — confirmed in `GameEngine.LandGrab.CompleteRegionPick`) — clear the tracked set (old
  timers are simply left to fire; their callback's `RoomActor` method call will be rejected by the
  engine as `StaleActivityToken`/`NotAwaitingThisInput`, the same harmless-no-op path
  `TimeoutElapsed` already relies on).
- For each bot-owned decision point still open under the *current* token that with no timer already
  tracked for it — resolve the eligible choices, pick a value via `BotChoice` up front (so the
  choice is committed once, not re-rolled if `ScheduleBotMoves` runs again for the same still-open
  question), pick a random delay, and schedule a `System.Threading.Timer` whose callback invokes
  the matching `RoomActor` public method with that pre-chosen value.

This naturally handles `PendingActivity.Question`'s multiple simultaneous participants: a
`Question`'s token stays the same across every participant's submission (only its `Submissions`
dict grows), so `ScheduleBotMoves` gets called again each time any participant answers, but the
already-scheduled bot participants are skipped (already tracked) and only not-yet-submitted bot
participants get newly scheduled — each bot's delay runs independently of when siblings answer, so
one participant answering can't reset or extend another's already-ticking delay.

### 5. Delay shape: a random fraction of the time remaining until the deadline
`delay = remaining * random-fraction-in-some-band`, clamped to a small floor/ceiling (e.g. never
under ~1s so it's not instant, never so long it risks racing the deadline timer). Computed from
`pending.Deadline.Since(now)` — the same quantity `ArmEngineTimer` already computes — so it scales
automatically with whichever activity's own duration (`GameRules.BasePickDurationSeconds`,
`LandGrabPickDurationSeconds`, `ChoiceQuestionDurationSeconds`, `TipQuestionDurationSeconds`,
`AttackTargetSelectionDurationSeconds`) is currently in effect, without hardcoding per-activity
constants in the bot driver.

## Risks / Trade-offs

- **[Risk]** A bot's scheduled `Timer` callback fires on a thread-pool thread, not the room's pump
  thread. → **Mitigation**: this is already how every human command arrives (`GameHub` calls
  `RoomActor`'s public methods from arbitrary SignalR threads); those methods only ever post onto
  the mailbox (`TryPost`) and return a `Task`, so calling them from a timer callback is exactly as
  safe as calling them from a hub method.
- **[Risk]** Unbounded growth of tracked `(Token, PlayerId)` pairs / stray `Timer` objects across a
  long match. → **Mitigation**: the tracked set is cleared on every token change (i.e. every turn),
  and each `Timer` is single-shot (`Timeout.InfiniteTimeSpan` period) and self-disposes after firing
  once, same pattern `_engineTimer` already uses.
- **[Risk]** A bot's chosen numeric guess could occasionally be wildly implausible (e.g. a
  four-digit-year question guessed as `3`) since there's no bounds metadata to guess against. →
  **Mitigation**: accepted as a non-goal — ranking for `Tip` questions is by closeness
  (`AnswerEvaluator`'s `Penalty`), so an implausible bot guess just reliably loses to any human who
  guesses in the right order of magnitude, which is a fine outcome for an intentionally-not-smart
  bot.
- **[Trade-off]** Committing to a bot's choice at schedule time (rather than re-evaluating right
  before submission) means if the eligible set could theoretically change between scheduling and
  firing, the committed choice might no longer be eligible. In practice this can't happen for the
  activity types in scope: `BasePick`/`RegionPicks`/`TargetSelection` are single-actor per token (no
  other player can act mid-turn), and a `Question`'s option set is fixed once asked. If the
  `RoomActor`-side submit call is nonetheless rejected for any reason, it's a silent no-op and the
  existing `TimeoutElapsed` fallback still resolves the activity — never a crash or a faulted room.

## Migration Plan

Additive only — new file (`BotChoice.cs`), a new dedicated `IRandomSource` field, and new private
methods/fields on `RoomActor`. No existing DTOs, commands, or Domain types change shape. No data
migration. Ships as a single change; nothing to roll back beyond reverting the commit if a bot
turns out to submit somewhere it shouldn't (guarded by existing validation regardless).

## Open Questions

- Exact random-fraction band and floor/ceiling for the thinking delay (e.g. 25%-65% of remaining
  time, floor 1s, ceiling ~6s) is a feel/pacing call best tuned during play-testing rather than
  fixed in this design.
