## Context

Three additive mechanics land in the same change because they touch overlapping plumbing (`GameRules`,
`PlayerState`, the event stream, `StateProjector`, the lobby, the client's reveal pipeline) but are
otherwise independent in *when* they trigger: answer streaks piggyback on every existing answer
resolution, the category ban draft is a self-contained phase that only runs once before
`BaseSelection`, and golden question is a flag carried on the pending question state that a handful of
existing resolution paths (land grab award queue, duel score, base-assault score/HP, self-heal) each
check. See `proposal.md` for the "why."

Relevant existing plumbing this design builds on:
- `PlayerState.BonusScore` already exists as the "score not tied to a region" channel, populated today
  by `GameRules.BaseAssaultScoreBonus` (see `battle-flow`). Answer streaks reuse it rather than
  inventing a second score channel.
- `GameState.ScoreOf` already folds `BonusScore` into the player's total, so nothing there needs to
  change.
- Companion events (`BaseAssaultScoreAdjusted`, `DuelDefenseScoreAwarded`) already exist alongside the
  primary resolution event to carry a side-effect without touching the primary event's shape. Streak
  awards and golden reveals follow the same pattern instead of widening `QuestionResolved`.
- `TieBreakOrder` is already "decided once, at ask time, and stored in state" (see `answer-ranking`) -
  the same shape a per-question golden flag needs, decided at ask time and revealed at resolve time.
- `IRandomSource` is seeded per room and is the only source of randomness `Triviador.Domain` is allowed
  to touch (`CLAUDE.md`); every new random draw in this change (category-ban resolution, golden
  scheduling) goes through it.

## Goals / Non-Goals

**Goals:**
- Each of the three mechanics is independently toggleable via `GameRules`, defaulting to on, with zero
  behavioral difference from today when off.
- Reuse existing plumbing (`BonusScore`, companion events, `IRandomSource`, the reveal/mute pipeline)
  instead of adding parallel mechanisms.
- Keep golden status un-derivable by any client before that question's own resolution - this is an
  anti-cheat property, not just a UX one, so it lives in what `StateProjector` is willing to expose,
  not just in what the client chooses to render.
- Structure the work (below, and in `tasks.md`) so the three mechanics can be implemented and reviewed
  in parallel: they touch disjoint new files/fields for the most part, and where they touch a shared
  file (`GameRules`, `GameEvents`, `contracts.ts`), the additions are pure appends, not edits to
  existing lines, so parallel branches don't collide.

**Non-Goals:**
- No attempt to make `GoldenQuestionMinCount`/`MaxCount` a hard guarantee for pathologically short
  games (e.g. an near-instant elimination). See Risks.
- No UI for the host to customize *which* categories are eligible for the ban draft, or to preview the
  golden-question count/spacing - only the three on/off toggles are host-configurable, per the
  proposal.
- No persistence of streaks, bans, or golden schedules beyond the lifetime of one game; nothing here
  is carried into a rematch.

## Decisions

### Streak bonus formula and channel
Award = `streakBeforeThisAnswer * GameRules.AnswerStreakBonusPerStreak`, added to the same
`PlayerState.BonusScore` field `BaseAssaultScoreBonus` already uses. Alternative considered: give the
base region itself a per-player value bump (closer to the user's literal phrasing "my base gets
+100"). Rejected because `RegionState`/`MapDescriptor.Regions[].Value` are static per-map data, not
per-player, and `GameState.ScoreOf` already special-cases a player's own base to a flat 1000 - bolting
a variable bonus onto that path would mean two competing "extra score" mechanisms doing the same job.
`BonusScore` already is "score not tied to a region" and already free-floats into `ScoreOf`; reusing it
is a one-line addition instead of a new derived-state path.

A companion event, `StreakBonusAwarded(PlayerId, StreakCount, BonusAwarded)`, is emitted alongside the
existing resolution event whenever the bonus is non-zero, mirroring `BaseAssaultScoreAdjusted`. The
persistent streak count itself is not event-sourced separately - it's plain `PlayerState`, visible via
projection - only the *award moment* gets its own event, since that's what the client needs to trigger
a one-shot animation.

### Category ban draft as a new phase, not a lobby sub-step
`Phase` gains a `CategoryBan` value, entered from `Lobby` on `StartGame` when the toggle is on, and
exited into `BaseSelection` exactly as `Lobby` exits into `BaseSelection` today when the toggle is off.
This was chosen over folding the draft into `Lobby` itself (e.g. as pre-start chat) because the
existing `Lobby` legal-command set (`JoinGame`/`LeaveGame`/`StartGame`) and the invariant "once the
game has left `Lobby`, there's always a pending activity or `Finished`" both assume `Lobby` has no
notion of a per-player deadline-bound submission - a full phase reuses that invariant machinery
(pending activity, deadline, `TimeoutElapsed`) instead of inventing a parallel "pre-game input" concept
that would need its own timeout handling.

A new pending-activity kind, `CategoryBanProposal(ActivityToken, ImmutableArray<CategoryId>
AvailableCategories, Instant Deadline)`, mirrors the existing `Question` pending-activity's
simultaneous-multi-participant shape (every active player answers/proposes independently against one
shared deadline) rather than the single-actor `BasePick`/`TargetSelection` shape.

### Category ban resolution order and randomness
Resolution runs once, when the last proposal arrives or the deadline elapses - a single deterministic
pass in seat order, not "as each proposal happens to resolve," so replay from `(seed, command log)`
reproduces the same banned set regardless of network arrival order (same rationale as canonical
iteration order elsewhere in `Triviador.Domain`). For each player in seat order: if their proposal is
non-empty, draw one entry from it via `IRandomSource`; if empty, draw one entry from the full canonical
set minus categories already banned earlier in this same pass. Two players landing on the same category
is accepted as-is (per the user's explicit choice) rather than re-drawing for uniqueness - simpler, and
the resulting "sometimes fewer than N bans" outcome is itself a small extra source of game-to-game
variance, which fits this change's overall goal.

### Golden question scheduling
A budget of `GoldenQuestionMinCount`-`GoldenQuestionMaxCount` (2-3) is drawn once, at `GameStarted`,
via `IRandomSource`. A per-game monotonic "question sequence number" increments on every `QuestionAsked`
of any purpose (land grab, duel, assault, self-heal, tiebreak). Each time a question is asked with the
budget not yet exhausted and at least `GoldenQuestionCooldownQuestions` non-golden questions since the
last golden one (or none yet marked), a seeded weighted draw decides whether *this* question is golden;
the weight is tuned so the budget is very likely spent by the time a typical game (12-round default)
finishes, without guaranteeing it (see Risks). The golden flag lives on the pending question's own
state (next to its `TieBreakOrder`, decided at ask time) and is deliberately excluded from
`QuestionAsked`'s projection and from `StateProjector`'s in-flight question view - it only becomes
readable once resolution produces the companion `GoldenQuestionRevealed(ActivityToken)` event, emitted
alongside `QuestionResolved`/`RevealHoldStarted` for the same token. This mirrors
`BaseAssaultScoreAdjusted` again: a companion event rather than widening `QuestionResult`, so nothing
already reading `QuestionResult` needs to change, and there is no field on any pre-resolution DTO for a
compromised client to read early.

Doubling is applied at each resolution site (award-queue sizing in land grab; `DuelDefenseScoreAwarded`
amount; `BaseAssaultScoreAdjusted` deltas and hit-point delta; self-heal hit-point delta; the streak
bonus for that same answer, if any) by checking the resolved question's golden flag - no separate
"golden effect" pipeline, since the effect is always "double whatever this resolution already computes."

### Settings command
A new host-only command, `SetGameSettings(EnableAnswerStreaks, EnableCategoryBanDraft,
EnableGoldenQuestion)`, legal only in `Lobby` and only from the host, updates the room's draft
`GameRules` before `StartGame` builds the immutable `GameState` from it - the same authorization
pattern `SetSeat`/`KickPlayer` already use. `StartGame` itself is unchanged; it simply reads whatever
`GameRules` the room has accumulated by the time it's called.

## Risks / Trade-offs

- [Risk] A very short game (fast elimination in the first few battle turns) might ask too few total
  questions to ever reach `GoldenQuestionMinCount` golden questions, since the cooldown-gated
  probabilistic draw needs a minimum number of asks to fire at all → Mitigation: this is an accepted,
  documented edge case, not a bug - the golden-question spec's "between Min and Max" scenario is written
  against "a game runs its full course," and a pathologically short game is not that. No forced
  end-of-game golden question is added, to avoid a jarring "surprise golden question on the very last
  ask of the game" that the cooldown/spacing requirement would otherwise forbid anyway.
- [Risk] Doubling `BaseHitPointsChanged` by 2 on a golden assault hit changes how quickly a base can
  fall (a full-health base could drop from `BaseHitPointsDefault` to 0 in fewer turns than before) →
  Mitigation: capped at 0 (never negative) exactly like ordinary damage; this is an intentional,
  bounded spike consistent with the mechanic's purpose, not an uncapped multiplier.
- [Risk] Reusing `BonusScore` for both the streak bonus and the existing base-assault bonus means a
  single number in `PlayerState` now has two contributors → Mitigation: this is already true today
  (`BaseAssaultScoreBonus` and `DuelDefenseScoreAwarded` both move the same field); the streak bonus
  is a third contributor to an already-shared channel, not a new pattern.
- [Trade-off] Category-ban overlap (two players' draws landing on the same category) means the actual
  banned-category count is not guaranteed to equal the player count → this is an explicit product
  decision (see proposal.md), not an oversight.

## Migration Plan

No data migration: there is no persisted game state across deploys (a room's `GameState` lives only
for the lifetime of that room). Rolling this out is a normal deploy - existing in-flight rooms at
deploy time are unaffected either way since `Triviador.Web` restarts drop in-memory rooms today
regardless of this change. `GameRules.Default` sets all three new toggles to `true`, so any code path
that constructs `GameRules` without going through the new lobby settings command still gets the new
behavior on, matching "default enabled" from the proposal.

## Parallelization plan (for `tasks.md`)

The three mechanics are implemented as three mostly-independent workstreams that only share
append-only edits to `GameRules`, `GameEvents.cs`, `Phase`/`PendingActivity` unions, `StateProjector`,
and `contracts.ts`:

- **Stream A - Answer streaks**: `PlayerState.AnswerStreak`, the bonus calculation hooked into the one
  shared point where every question type already resolves tier/penalty (per `answer-ranking`), the
  `StreakBonusAwarded` event, its projection, and the client avatar badge/tiers/rainbow CSS.
- **Stream B - Category ban draft**: the new `CategoryBan` phase, `ProposeCategoryBans` command,
  resolution algorithm, `IQuestionRepository` category-exclusion support, bot proposal logic, the lobby
  settings panel (shared with Stream C/D for the other two toggles), and the client ban-picker
  screen/emoji map.
- **Stream C - Golden question**: the per-game budget/cooldown scheduler, the golden flag on pending
  question state, the doubling hooks at each resolution site, the companion reveal event, and the
  client's golden reveal animation/sound (building on the existing reveal pipeline from the archived
  `answer-reveal-sound-feedback`/`archery-reveal-animation` changes).
- **Stream D - Cross-cutting**: `GameRules` toggle fields + `SetGameSettings` command + lobby settings
  UI shell (the three toggle checkboxes; Streams B/C each render their own toggle's row once the shell
  exists), and the one-time `contracts.ts` sync pass covering all three streams' new DTOs/events.

Sequencing: Stream D's `GameRules` fields and command scaffold should land first (or in the same PR as
whichever of A/B/C lands first) since A/B/C all read their toggle from it; after that, A, B, and C have
no file-level overlap with each other and can proceed fully in parallel.
