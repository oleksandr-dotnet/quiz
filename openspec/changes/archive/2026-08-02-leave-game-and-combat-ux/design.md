## Context

Four features, two in Application/Domain (leave-and-takeover, self-heal) and two purely in the
client (`client-presentation`/`client-audio-feedback`). Grounded in the current code:

- **Leave/disconnect today** (`RoomActor.cs`): `HandleLeaveAsync` (line 296) calls `seat.Clear()`
  unconditionally, whether or not `_engine` exists. Mid-game, this wipes `Seat.PlayerId` while the
  domain engine's `GameState.Players` still contains that `PlayerId` as an active, non-eliminated
  participant - `BuildGameView`'s `seatsByPlayerId` (line 579) can no longer find a seat for them, so
  `isConnected` (line 587, `seat is null || seat.IsBot || seat.IsConnected`) evaluates to `true` for a
  player who is actually gone, and nobody ever plays their remaining turns except via the existing
  per-activity timeout fallback (no bot decision-making kicks in, since `IsBotPlayer`, line 834, can
  no longer find the seat either once cleared). Separately, `HandleConnectionLostAsync` (line 317)
  only clears `ConnectionId`, with no bot-conversion at all - a bare disconnect is deliberately kept
  non-blocking-but-passive per `room-lobby`'s existing "Disconnection is visible but non-blocking"
  requirement, and this change does not touch that path.
- **Bot scheduling** (`RoomActor.cs`): `ScheduleBotMoves(PendingActivity)` (line 768) is the existing,
  fully general "does a bot own the current pending activity, and if so schedule its move" routine,
  driven off `Seat.IsBot` via `IsBotPlayer` (line 834). It already handles every pending-activity
  subtype (`BasePick`, `RegionPicks`, `TargetSelection`, `Question`). Flipping a seat's `IsBot` to
  `true` is sufficient for it to treat that seat as bot-controlled with no changes to `BotChoice.cs`
  itself.
- **Battle/assault flow** (`GameEngine.Battle.cs`): `EligibleAttackTargetsFor` (line 74) excludes
  every region the attacker owns (line 83: `if (ownerId is null || ownerId == attacker) return
  false;`), which is exactly why self-targeting has never been possible - not from an explicit
  attacker/defender equality check, but from ownership filtering. `StartBattleQuestion` (line 143)
  derives `defender` purely from `_state.RegionOf(targetRegionId).OwnerId` - if the target is the
  attacker's own base, `defender` naturally equals `attacker` with no special-casing needed there.
  `AnswerRanker.Rank` (`AnswerRanker.cs`) ranks whatever `Participants` array a `PendingActivity.
  Question` carries; nothing about it assumes exactly two participants. `AttackerWon` (line 251)
  does assume two *distinct* ranked entries and would be meaningless (`attackerRank < defenderRank`
  is always false when they're the same record) for a self-targeted question with attacker==defender.
- **Client "in-progress fight" signal**: `GameView.battle` (`BattleContextDto`, populated by
  `RoomActor.ToBattleContext`, lines 693-701) is non-null exactly while a Battle `Question` or
  `RevealHold` is pending, and already carries `kind` (`Duel`/`BaseAssault`), `contestedRegionId`,
  `attackerPlayerId`, `defenderPlayerId`. `RegionShape.tsx`'s `.contested-marker` (lines 84-94) is
  the only existing "under attack" visual, driven by a single `contestedRegionId` prop threaded
  through `battleMapProps` (`BattleScreen.tsx:13-20`) → `GameMap` (`GameMap.tsx:79`). `WaxSeal.tsx`
  has no "under attack" visual state at all today. `useGameTransitions.ts`'s `baseDamaged` transition
  (lines 43-50) only fires *after* HP has already dropped, driving a generic whole-map `.shell-map.
  shake` (`App.tsx:109-156`, `AppShell.tsx`) - it says nothing about an assault merely *starting*.
  Sound (`lib/sound.ts`) is pure Web Audio synthesis (`tone()`, no audio assets), currently invoked
  from exactly one place, `RevealOverlay.tsx:28-36`, on reveal.

## Goals / Non-Goals

**Goals:**
- A player can leave an in-progress game; their seat becomes bot-controlled immediately and stays
  that way for the rest of the game, including finishing out whatever activity they were the current
  actor for.
- A player can spend their attack turn on their own (damaged) base instead of an enemy, healing it 1
  HP on a correct answer, with no other change to Battle's turn/round structure.
- A duel or an assault on someone else's territory reads as visibly "a fight is happening" on the map
  (stronger animation, a sound cue); an assault on the *viewer's own* base reads as more urgent still.

**Non-Goals:**
- No reconnect-reclaims-control path: once a player explicitly leaves mid-game, that seat is bot-only
  for the rest of that game (simplest correct behavior; matches "bot continues playing for him", not
  "seat waits for them to come back"). A later change could add reclaiming if wanted.
- No change to bare-disconnect behavior (`room-lobby`'s existing "visible but non-blocking" rule is
  untouched) - only an *explicit* leave action triggers takeover.
- No multi-question self-heal chain. Unlike an assault on an enemy base (up to 3 questions per turn),
  self-heal is exactly one question per turn - healing is not a race against anyone, and letting a
  player farm multiple HP in one turn would be a strictly-better-than-attacking option with no
  offsetting risk.
- No new `GameRules` tunable for self-heal's availability window - it reuses
  `BaseAssaultsUnlocked()`'s existing final-rounds gate (see Decisions) rather than introducing a
  second window to reason about.
- No changes to `AnswerRanker`/`AnswerEvaluator`/`TieBreakOrder` themselves - self-heal's correctness
  check reads the existing single `RankedAnswer` the ranker already produces for one participant.

## Decisions

### Leave-and-takeover is an `Application`-layer seat flag flip, not a new Domain command
`PlayerState` (Domain) has no bot/human concept at all - `Seat.IsBot` (Application) is the only
source of truth `ScheduleBotMoves`/`IsBotPlayer` already consult. So "this player left, a bot plays
for them now" needs zero Domain changes: `HandleLeaveAsync` gets a phase branch -
- `_engine is null` (still in the Lobby): unchanged, `seat.Clear()` frees the seat exactly as
  `room-lobby` already specifies.
- `_engine is not null` (mid-game): instead of `Clear()`, set `seat.IsBot = true` and
  `seat.ConnectionId = null` (release their connection so `HasConnectedHuman`/`RoomJanitor` don't
  count them), but **keep** `PlayerId`/`DisplayName`/`PlayerToken` intact - the domain engine's view
  of this `PlayerId` never changes, only who submits commands for it now. Then call
  `ScheduleBotMoves(_engine.State.Pending)` immediately (mirroring what `ArmEngineTimer` already does
  after every command), so a player leaving exactly during their own pending turn gets a bot move
  scheduled right away instead of waiting for the timeout fallback to eventually resolve it.
- Alternative considered: model this as a new Domain event/command (e.g. `PlayerLeftMidGame`). Rejected
  - there is nothing for the Domain engine to validate or react to; `PlayerId` participation, turn
  order, and elimination are all unaffected by who operates a seat. Keeping this entirely in
  Application matches the existing bot/human split (`IsBot`/`IsConnected` already live only in
  `RoomActor.Seat`) and needs no new `RejectionCode`.
- `LeaveRoom` (the SignalR hub method, `GameHub.cs:70`) and `leaveRoom()` (the client command,
  `commands.ts:13`) are already wired end-to-end and phase-agnostic; no server API surface changes.

### `room-lobby`'s seat-lock requirement gets a narrow carve-out, not a rewrite
The existing requirement ("no seat's occupant SHALL change" once the game starts) is about the host's
toggle control disappearing, not about this new player-initiated leave path. The delta spec narrows
its scope to explicitly exclude the leave-and-takeover path, rather than loosening it generally - a
seat's *identity* (which `PlayerId` plays it) still never changes mid-game; only its *control mode*
(human vs. bot) can, and only via this one explicit action.

### Self-heal reuses `QuestionPurpose.BaseAssault` with `Attacker == Defender`, not a new purpose type
Targeting your own base already produces `defender == attacker` for free, since `StartBattleQuestion`
derives `defender` from region ownership. Three follow-on special cases, all in
`GameEngine.Battle.cs`:
1. **`EligibleAttackTargetsFor`**: append the attacker's own base region as an extra candidate
   (outside the existing owner-exclusion filter) exactly when `BaseAssaultsUnlocked()` and the
   attacker's own `BaseHitPoints < GameRules.BaseHitPointsDefault`. Appended after the (deterministic,
   `Map.Regions`-ordered) enemy-target list, so iteration order stays fully deterministic.
2. **`AskBattleQuestion`**: when `attacker == defender`, build `Participants` as the single-element
   `ImmutableArray.Create(attacker)`, not a two-element array with a duplicate `PlayerId` - a
   duplicate would break `PendingQuestionViewDto`'s `hasAnswered` dictionary build (keyed by player,
   `RoomActor.cs:620`) with a duplicate-key exception. `TieBreakOrder` for one participant can be any
   valid single-element order (tie-break never matters with nothing to tie against); reuse
   `TieBreakOrder.Prefer(attacker, attacker)` for the shared code shape, since `IndexOf` only needs to
   resolve to *some* index for the one player present. `ResolveQuestion` and `AnswerRanker.Rank`
   already generalize over `Participants.Length` correctly for `1` - confirmed by reading
   `GameEngine.LandGrab.cs`'s shared `ExecuteSubmitAnswer`/`ResolveQuestion` (`ResolveQuestion`
   defaults any non-answering participant to `AnswerValue.None`, then ranks whatever's there; nothing
   assumes exactly two).
3. **`ResolveRevealHold`'s `BaseAssault` branch**: an `if (assault.Attacker == assault.Defender)`
   branch entirely separate from the existing damage/chain logic - `AttackerWon` cannot be reused here
   (it compares two ranks that would be the same record when attacker==defender, always evaluating to
   "attacker did not win"). Instead, correctness is read directly off the single `RankedAnswer`:
   `Tier == 0 && Penalty == 0` (exact correctness - for a `Choice` question, `Tier 0` already means
   exactly right; for a `Tip`/numeric question, `Penalty` is the absolute distance from the correct
   value, so `Penalty == 0` is required too, since numeric answers are otherwise ranked by closeness,
   not exactness, and "closer than no one" isn't a meaningful heal condition). On a correct answer:
   `BaseHitPoints = Math.Min(BaseHitPoints + 1, GameRules.BaseHitPointsDefault)`, emitting the
   existing `BaseHitPointsChanged` event (already generically named, not `BaseHitPointsReduced` -
   reused as-is rather than adding a new event type). Either way (heal or no-op), the turn ends after
   exactly one question via `AdvanceTurn(at)` directly - no `CheckEndConditions()` call, since
   self-heal can never eliminate anyone or roll a round over by itself.
- Alternative considered: a dedicated `QuestionPurpose.SelfHeal(PlayerId, RegionId)` case. Rejected as
  an unnecessary parallel type - every other piece of Battle machinery (target eligibility, question
  asking, reveal projection) already treats a base-region target uniformly as `BaseAssault`; splitting
  it would duplicate `ToBattleContext`, `battleHeadline`, and the DTO shape for no behavioral gain,
  when the existing `Attacker == Defender` equality is a sufficient, already-projected signal (`Game
  ViewDto.battle.attackerPlayerId == battle.defenderPlayerId`) for the client to key off of.

### Client "under attack" effects key off `GameView.battle`/`contestedRegionId` directly, not a new transition type
Both new visual effects are **sustained state**, not one-off transitions: "this region/base is
currently being fought over" for as long as `view.battle` says so, not "something just changed".
That's a plain render-time condition, not something `useGameTransitions` (which diffs consecutive
snapshots for edge-triggered events like `baseDamaged`) needs to grow a new case for:
- **Territory-under-attack** (any viewer, any duel/regular-base-assault): escalate the existing
  `.contested-marker`/`contested-pulse` (`RegionShape.tsx:84-94`, `App.css:571-583`) to a stronger
  animation (larger glow radius, faster/higher-contrast pulse, akin to the existing `active-turn-glow`
  pattern at `App.css:893-902`), and add a new `playAttackStarted()` sound cue (same `tone()`-based
  synthesis as `playCorrect`/`playIncorrect` in `lib/sound.ts`) fired once per new contested target.
  "Once per new target" is tracked with a ref keyed on `` `${battle.attackerPlayerId}:${battle.
  contestedRegionId}:${battle.assaultQuestionIndex}` `` (or similar) inside whichever component holds
  the effect (`BattleScreen`'s `BattleDock` is the natural home, since it already receives `view.
  battle`), so a re-render or a chained assault question doesn't replay the cue mid-fight, but a
  genuinely new attack does. Excluded whenever `battle.attackerPlayerId === battle.defenderPlayerId`
  (the calm self-heal case) - self-heal gets no alarm sound and no escalated marker; the plain,
  existing pulse (if any) is enough, since nothing is actually at risk.
- **Your-own-base-under-attack** (viewer only, `BaseAssault` with `defenderPlayerId === view.
  youPlayerId` and `attackerPlayerId !== defenderPlayerId`): a further-escalated, distinct effect on
  that base's `WaxSeal` (new prop, e.g. `underAttack: boolean`) - a red vignette/pulse ring around the
  seal, plus reusing/intensifying the existing whole-map `.shell-map.shake` class for the duration of
  the assault rather than only the instant-after-hit shake `baseDamaged` already drives. This is
  additive to, not a replacement for, the existing `baseDamaged`-triggered shake.
- All new animation classes get an entry in the existing `prefers-reduced-motion: reduce` block
  (`App.css:585-592`), matching every other animation in the file, collapsing to a static (but still
  present, e.g. a solid instead of pulsing outline) danger indicator.

### Explicit leave affordance lives in the persistent header, not per-screen
`leaveRoom()`/`LeaveRoom` already exist and are invoked from `LobbyScreen` and `ResultsScreen`. Adding
a mid-game "Leave game" action next to the existing `MuteToggle` in `App.tsx`'s `TopBar` (rendered
inside `AppShell` for every in-game phase) reuses the same call with no new hub method, gated by a
confirmation prompt (`window.confirm`, matching the destructive/irreversible nature the Non-Goals
section calls out) before invoking `leaveRoom()` then `setSession(null)` (same pattern
`ResultsScreen.onLeave` already uses) to return the leaving client to the landing screen.

## Risks / Trade-offs

- **[Risk] A player leaves exactly as the current `TargetSelection`/`Question` actor, and the
  immediate `ScheduleBotMoves` call races the in-flight command that triggered the leave itself.** →
  Mitigation: both run on the single-threaded room-actor mailbox pump (one message processed at a
  time), so there's no actual concurrency to race - the leave message fully completes (including the
  `ScheduleBotMoves` call) before the next mailbox message is read, exactly like every other command.
- **[Risk] A self-heal's `BaseHitPointsChanged` event with an *increased* value could confuse a naive
  client transition reader expecting HP to only ever decrease.** → Mitigation: `useGameTransitions`'s
  `baseDamaged` case already explicitly checks `p.baseHitPoints < prevP.baseHitPoints` (strictly
  less), so an increase already produces no transition at all today, with no client change required
  for correctness - only the new explicit "healed" feedback (a positive cue, out of scope for the
  urgent-effects requirement but worth a small positive nod in tasks.md) needs to detect the increase
  case deliberately.
- **[Risk] Escalating `.contested-marker` and adding a sustained map-shake for the whole assault
  duration (not just the post-hit instant) could feel visually noisy across a long assault chain
  (up to 5 questions against one base).** → Mitigation: keep the *sustained* under-attack indicator
  calmer (glow/vignette) and reserve the punchier shake specifically for the existing edge-triggered
  `baseDamaged` moment, so a long chain reads as "still tense" throughout but only "hits" on an actual
  HP loss, not a constant shake for the whole exchange.
- **[Trade-off] No reconnect-reclaims-control path.** A player who leaves by accident cannot get their
  seat back this game. Accepted per Non-Goals - matches the literal ask ("bot continues playing for
  him") and keeps the change small; the confirmation prompt in the UI is the mitigation for
  accidental clicks.

## Migration Plan

No data migration (in-memory room state only, no persistence layer). Deploy as a normal release;
existing in-flight games at deploy time are already tolerant of a mid-deploy restart per existing
`RoomJanitor`/reconnect behavior (unaffected by this change). No feature flag - all four pieces are
additive/narrowly-scoped enough to ship directly, matching how prior OpenSpec changes in this repo
have shipped (see `bot-gameplay`, `battle-flow` archive history).

## Open Questions

None outstanding - scope, DTO impact (none beyond the client hand-mirrored `contracts.ts`, which needs
no new fields since self-heal reuses existing `BattleContextDto` fields and leave-takeover needs no
DTO changes at all), and every touched file are settled by the Decisions above.
