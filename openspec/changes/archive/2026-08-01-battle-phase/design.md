## Context

Land grab fills the map and stops: `CompleteLandGrab` sets `Pending = null` and emits
`LandGrabCompleted`, leaving `GameEngine.cs`'s `AssertInvariant` with a documented
`awaitingFutureBattle` escape hatch. Everything Battle needs was declared ahead of time by earlier
changes and has zero writers today:

- `QuestionPurpose.Duel(Attacker, Defender, Region)` and
  `QuestionPurpose.BaseAssault(Attacker, Defender, BaseRegion, QuestionIndex, DamageDealtThisTurn)`
- `PendingActivity.TargetSelection(Token, Deadline, Player)` and
  `PendingActivity.RevealHold(Token, Deadline, QuestionResult Result)`
- `TieBreakOrder.Prefer(defender, attacker)`
- `PlayerState.Eliminated` (read by `ActiveParticipants()`, never written)
- `GameState.Outcome` (`GameOutcome? Outcome`, never written)
- `GameRules.RoundLimit` (never read)

`QuestionAsked`/`QuestionResolved`/`SubmitAnswer` are already phase-agnostic — they carry
`QuestionPurpose` and don't know which phase asked. Land grab's `ExecuteSubmitAnswer` is currently
gated to `Phase == LandGrab` only; Battle needs the same command to work for its own questions too.

## Goals / Non-Goals

**Goals:**
- Close the `LandGrab`/`Pending == null` gap: `GamePhase.Battle` runs turn-based duels and base
  assaults to a real conclusion (`GamePhase.Finished` with a `GameOutcome`).
- Reuse the existing `Question`/`AnswerRanker`/`SubmitAnswer`/`QuestionAsked`/`QuestionResolved`
  machinery verbatim for duel and assault questions — no parallel answer-submission path.
- Implement `RevealHold` as a real, timer-driven pending activity for Battle's reveals.
- Make base HP persistent and global (survives across turns and across different attackers) without
  storing it on `RegionState`, since a captured base immediately stops needing HP at all.
- Preserve every existing invariant: rejection precedence, stale-token no-ops, Finished-or-pending,
  canonical iteration order, no ambient time/randomness in `Triviador.Domain`.

**Non-Goals:**
- Retrofitting land grab's already-shipped, already-verified client-side reveal fade timer onto
  `RevealHold`. Land grab keeps its current mechanism; `RevealHold` is new machinery Battle
  introduces for its own reveals, not a required refactor of working code elsewhere.
- Bot decision-making (M6). Bot seats continue to behave exactly as they did during land grab:
  unresponsive humans that let every pending activity time out. Every new pending-activity shape this
  change introduces must have a `TimeoutElapsed` fallback that keeps the game completable with 1
  human + 3 silent seats, the same bar land grab was held to.
- Expanded question content (M7) or visual polish — HP shake, capture flash, toasts (M8).
- A `StateProjector` extraction — secrecy stays in `RoomActor.BuildGameView`, per land-grab-phase's
  existing, unrevisited decision.

## Decisions

### D1: Widen `ExecuteSubmitAnswer`/`ResolveQuestion` to `Phase is LandGrab or Battle`, branch on `Purpose`

Alternative considered: a parallel `GameEngine.Battle.cs` copy of `ExecuteSubmitAnswer`. Rejected —
`SubmitAnswer`'s command shape has no phase or purpose discriminator; the `ActivityToken` alone
already identifies the one open question regardless of phase, and `ResolveQuestion` already branches
on `pending.Purpose` for post-resolution effects (land grab's dead-round/award-queue logic vs.
Battle's capture logic is just another arm of that same switch). Duplicating the command handler
would let the two paths drift on rejection precedence or secrecy — the exact bug class
`game-setup-rules` exists to prevent. `ExecuteSubmitAnswer`'s phase check becomes
`Phase is GamePhase.LandGrab or GamePhase.Battle`, otherwise unchanged; `ResolveQuestion`'s
post-resolution switch gains `QuestionPurpose.Duel` and `QuestionPurpose.BaseAssault` arms alongside
the existing `QuestionPurpose.LandGrab` one.

### D2: `PendingActivity.TargetSelection` gains an eligible-target list, following `RegionPicks`

`TargetSelection(Token, Deadline, Player)` as declared has nowhere to carry "which regions can this
player legally attack" — every other multi-option pending activity (`RegionPicks`) computes and
carries that list so the client never re-derives legality and a timeout has something concrete to
auto-pick from. Extend it to
`TargetSelection(Token, Deadline, Player, ImmutableArray<RegionId> EligibleTargetRegionIds)`,
computed fresh each turn by `EligibleAttackTargetsFor(player)`: every region owned by another
non-eliminated player that is adjacent (via the existing `AdjacencyIndex`) to any region the acting
player owns. Empty means `TurnSkipped(NoLegalTargets)` instead of asking.

### D3: Base HP lives on `PlayerState`, not `RegionState`

Base HP must be persistent (survives across turns, across different attackers) and global (whoever
attacks sees the same, already-damaged HP) — a plain per-`RegionState` field would work numerically,
but a base stops being special the instant it's captured (it becomes an ordinary territory worth its
map `Value`, full stop), so tracking HP on the region would require deleting the field on capture for
no benefit. `PlayerState` already models "this player's base" via `BaseRegion`; add
`BaseHitPoints` (internal set, initialized to `GameRules.BaseHitPointsDefault` — 3 — when a player's
base is selected) right next to it. `RegionState` gains nothing new.

### D4: `QuestionPurpose.BaseAssault`'s `DamageDealtThisTurn` tracks this turn's win count, not cumulative HP

`BaseHitPoints` (D3) is the persistent, cross-turn counter. `DamageDealtThisTurn` on the pending
question's `Purpose` is scoped to the current assault turn only, used solely to decide whether
another question should be asked (`QuestionIndex + 1 < min(3, defender.BaseHitPoints at turn start)`).
Each attacker win: decrement `PlayerState.BaseHitPoints` immediately (so a second attacker in a later
turn sees the already-damaged value), increment `DamageDealtThisTurn`/`QuestionIndex`, and either ask
the next assault question or (HP reached 0) capture. Any defender win ends the assault turn
immediately — already-dealt damage this turn stays applied (it was applied per-question, not batched
at turn end), the attacker's turn simply ends with no further questions.

### D5: `TieBreakOrder.Prefer(defender, attacker)` for every Battle question, `Shuffled` stays land-grab-only

Both duel and assault questions use `TieBreakOrder.Prefer(defender, attacker)` — already implemented
and already normative per `answer-ranking`'s existing spec text ("duel and assault tie-break always
favors the defender"). This needs no new Ranking code, just the right call site.

### D6: Round counting lives on `GameState`, incremented when the turn queue is rebuilt

Add `GameState.CurrentRound` (internal set, starts at 0, becomes 1 when Battle starts). Rebuilding
the `RoundQueue` from active players in seat order (i.e. every surviving player has now taken exactly
one turn) increments `CurrentRound`; end conditions check `CurrentRound > Rules.RoundLimit` — checked
after a capture and also after a round rolls over, so a `RoundLimit`-triggered end doesn't wait for a
capture that may never come.

### D7: End-condition check runs as one shared step after every state-changing Battle event

A single `CheckEndConditions(at): ImmutableArray<IGameEvent>?` (returns `null`/empty if the game
continues) runs after: a duel capture, a base-assault capture/elimination, and a round-rollover. Order
inside it: one player remaining → immediate win (even on lower score) → else `CurrentRound >
RoundLimit` → highest `ScoreOf` wins, ties become multiple winners → else continue. This single
choke point means "does the game end here" is answered in exactly one place, not re-derived at every
call site — the same reasoning `ScoreOf` and `IsBase` already followed for "derived, not duplicated."

### D8: `RevealHold` is real: every `QuestionResolved` during Battle is followed by a `RevealHold` pending activity before the next step

Unlike land grab (question resolves → immediately starts the next award queue / next question, reveal
pacing left to the client), Battle's `ResolveQuestion` arm for `Duel`/`BaseAssault` sets
`Pending = PendingActivity.RevealHold(token, deadline, result)` instead of immediately advancing.
`TimeoutElapsed` on a `RevealHold` token (the only legal input against it — nothing else can target
it) advances the pump: applies the already-decided capture/damage effects, then proceeds to
`CheckEndConditions` / next turn / next assault question. This means the *effect* of a duel or assault
question (region transfer, HP decrement) is applied when `RevealHold` resolves, not at
`QuestionResolved` time — `QuestionResolved`'s ranking is decided immediately (so the reveal broadcasts
the true result at once), but its consequences land one tick later, after players have had the
`GameRules.RevealHoldDurationSeconds` window to see it. This is the one place Battle's pump has an
extra step land grab's doesn't.

### D9: Base capture's exact ordering: transfer regions → set Eliminated → emit → CheckEndConditions → end turn

Named explicitly in the proposal and repeated here because it's a real footgun: `RegionsOwnedBy`-style
filters (as used by `ActiveParticipants`, `ScoreOf`, `EligibleAttackTargetsFor`) all check
`!player.Eliminated` or ownership after the fact. Setting `Eliminated = true` before transferring the
losing player's regions to the attacker would make any such filter skip that player's regions during
the transfer, silently leaving them ownerless. Transfer first, flip the flag second.

## Risks / Trade-offs

- **[Risk]** `RevealHold` adds a pending-activity hop to every Battle question, doubling the number of
  timers armed per question compared to land grab → **Mitigation**: `ArmEngineTimer` is already fully
  generic (reads `Pending.Token`/`.Deadline` only), so this costs zero new hosting code; the only new
  cost is one more `TimeoutElapsed` round-trip per question, which bot/disconnected-seat timeout
  fallback already handles identically to every other pending activity.
- **[Risk]** Two different reveal mechanisms now exist (land grab's client-timer vs. Battle's
  server-paced `RevealHold`) → **Mitigation**: accepted asymmetry (see Non-Goals) — the two phases
  have different pacing needs (Battle's reveal gates a real state change: capture/HP; land grab's
  reveal gates nothing but the next question), and retrofitting a shipped, verified phase is more risk
  than the inconsistency itself.
- **[Risk]** `CheckEndConditions` being called from multiple sites (capture, round-rollover) could
  diverge if one call site is missed → **Mitigation**: D7 makes it the single choke point; every
  Battle mutation path that could end the game routes through it rather than re-implementing the
  checks.

## Migration Plan

1. Domain: `GamePhase.Battle`; extend `PendingActivity.TargetSelection`, add `RevealHold` usage;
   `PlayerState.BaseHitPoints`, `GameState.CurrentRound`/`Outcome` writer; new
   `Commands.SelectAttackTarget`; new events (`AttackTargetRequested`, `RegionCaptured`,
   `BaseAssaultProgressed`, `BaseCaptured`, `PlayerEliminated`, `TurnSkipped`, `BattleCompleted`,
   `GameFinished`); `GameRules` additions (`AttackTargetSelectionDurationSeconds`,
   `BaseHitPointsDefault`, `RevealHoldDurationSeconds`).
2. `GameEngine.Battle.cs`: turn queue, `StartBattle` (called from `CompleteLandGrab` instead of
   `Pending = null`), `AskAttackTarget`/`ExecuteSelectAttackTarget`, duel/assault question-asking
   (mirroring `AskLandGrabQuestion`), `ResolveQuestion`'s new `Duel`/`BaseAssault` arms, `RevealHold`
   resolution, capture/elimination, `CheckEndConditions`. Extend `ExecuteTimeoutElapsed`'s switch.
   Delete `awaitingFutureBattle` from `AssertInvariant`.
3. Application: `GameViewDto` additions (pending target selection, pending reveal, `Eliminated` on
   `PlayerViewDto`, outcome/winners), `RoomMessage.SelectAttackTargetRequest`, `RoomActor` handler +
   `BuildGameView` extension, following the existing `Execute`/`ArmEngineTimer`/broadcast pattern
   exactly.
4. Web: `GameHub.SelectAttackTarget`.
5. Client: `contracts.ts`/`commands.ts` additions; `BattleScreen.tsx` (target selection, duel/assault
   question UI, reveal driven by the server's `RevealHold` deadline rather than a local timer);
   `ResultsScreen.tsx`; `App.tsx` explicit per-phase routing.
6. Manual verification via Playwright: a full game from land grab through at least one duel, one full
   base assault to elimination, and a `Finished` result, plus the timeout fallback path for every new
   pending-activity shape (mirroring land-grab-phase's task 7 verification depth).

## Open Questions

- None blocking — `Marathon`'s `RoundLimit = 30` preset already exists and needs no further design
  work now that `RoundLimit` is wired up.
