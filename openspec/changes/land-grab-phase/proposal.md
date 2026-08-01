## Why

`domain-kernel` built the `Ranking` kernel and declared `PendingActivity.Question`/`RegionPicks` and
`QuestionPurpose.LandGrab` up front specifically so a future phase could consume them, and
`start-game-and-base-selection` stopped deliberately at the moment every base is picked, leaving
`Phase == BaseSelection` with `Pending == null` as "the one documented exception" until `LandGrab`
exists. This change is that phase: once bases are set, players answer trivia questions to claim the
remaining territory, using the ranking kernel that already exists rather than a placeholder.

## What Changes

- Add `GamePhase.LandGrab` and wire it into `GameEngine`'s dispatch switch via a new
  `GameEngine.LandGrab.cs` partial, spliced into `CompleteBasePick`'s completion path so the last base
  pick now produces the first land-grab `Question` pending activity instead of `Pending == null`.
- Add `SubmitAnswer` and `PickRegion` commands and `QuestionAsked`, `AnswerAcknowledged`,
  `QuestionResolved`, `RegionPickRequested`, `RegionAwarded`, `LandGrabCompleted` events. `QuestionAsked`
  carries only a `QuestionPrompt` (no answer field exists on that type); `QuestionResolved` carries the
  full `Question`; `AnswerAcknowledged` carries a player id and never the submitted value.
- Implement the land-grab rules: all active players answer the same question simultaneously, ranked by
  the existing `AnswerRanker` with a shuffled `TieBreakOrder`; 1st place claims 2 territories, 2nd claims
  1, 3rd/4th claim none; picks must border a region the picker already owns whenever such a free region
  exists, falling back to any free region otherwise; the award queue is interleaved
  (`[1st, 2nd, 1st]`, not `[1st, 1st, 2nd]`) and truncated to the free-region count; a question where
  every participant fails to answer awards nothing and re-asks, auto-awarding via `IRandomSource` after
  3 consecutive dead rounds so a room of disconnected humans can't wedge the game; the phase repeats
  until every region is owned, then transitions onward (out of scope — the next change picks up there,
  the same pattern `start-game-and-base-selection` used for its own boundary).
- Add `GameRules` fields for land-grab pick duration, question durations (choice vs. tip), and the
  dead-round auto-award threshold — no new hardcoded constants in the engine.
- Supply the first real implementations of `IRandomSource` (in `Triviador.Infrastructure`, backed by
  `RandomNumberGenerator`, seeded per room) and `IQuestionSource`/a `QuestionDealer` (shuffled bags per
  kind, built once at `StartGame` from the room seed), plus placeholder question content
  (`Data/questions/*.json`) — neither interface has any implementation anywhere in the repo yet, and this
  phase is the first caller of both.
- Extend the Application-layer view (`GameViewDto`/`PlayerViewDto` or their successors) with score and a
  pending-question/activity projection that is secrecy-aware: another player's in-flight answer value
  must never appear before reveal, only whether they've answered.
- Extend `RoomActor` with mailbox handlers for `SubmitAnswer`/`PickRegion`, reusing the existing
  single-timer-per-pending-activity pattern for question and region-pick deadlines.
- Extend `GameHub` with `SubmitAnswer` and `PickRegion` methods, and the client with a land-grab screen
  (simultaneous question, countdown, choice/tip input, per-participant answered/not-answered status,
  reveal, then region-pick-after-win UI for whoever won territory that round).

## Capabilities

### New Capabilities
- `land-grab-flow`: the land-grab phase end to end — asking questions, ranking answers, the award queue
  and its interleaving/adjacency rules, dead-round handling, and the per-player view of an in-flight
  question and pending region picks (including what must stay hidden pre-reveal).

### Modified Capabilities
- `game-setup-rules`: removes the documented `BaseSelection`-completes-with-`Pending == null` exception
  — the Finished-or-pending invariant becomes unconditional for every phase past `Lobby`, and `LandGrab`
  joins the legal-commands table (`Question` pending → `SubmitAnswer`/`TimeoutElapsed`; `RegionPicks`
  pending → `PickRegion`/`TimeoutElapsed`).
- `base-selection-flow`: the "base selection's end is visible even though the next phase isn't built
  yet" requirement is replaced — completing base selection now visibly starts land grab instead of
  showing a dead-end state.

## Impact

- Affected code: `Triviador.Domain` (`State/GamePhase.cs`, `State/GameRules.cs`,
  `Commands/GameCommands.cs`, `Events/GameEvents.cs`, new `Engine/GameEngine.LandGrab.cs`,
  `Engine/GameEngine.BaseSelection.cs`'s completion path, `Engine/GameEngine.cs`'s dispatch switch and
  `AssertInvariant`), `Triviador.Application` (view DTOs, `RoomActor` mailbox handlers,
  a `IQuestionRepository`/`IRandomSource` DI seam), `Triviador.Infrastructure` (first `IRandomSource`
  implementation, `QuestionDealer`, `QuestionRepository`, `Data/questions/*.json`), `Triviador.Web`
  (`GameHub` additions), `Triviador.Client` (land-grab screen, store/contract additions).
- No changes to `Ranking/` — `answer-ranking` is already spec-complete and consumed as-is.
- No automated tests added by this change specifically (per `tests/README.md` policy); verification is
  manual/E2E as with prior changes.
