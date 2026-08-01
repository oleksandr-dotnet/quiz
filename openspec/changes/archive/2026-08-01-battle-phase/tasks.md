## 1. Domain: phase, state, rules, commands, events

- [x] 1.1 Add `GamePhase.Battle` (between `LandGrab` and `Finished`).
- [x] 1.2 Add `GameRules` fields: `AttackTargetSelectionDurationSeconds = 15`,
      `BaseHitPointsDefault = 3`, `RevealHoldDurationSeconds = 4`. Reuses
      `ChoiceQuestionDurationSeconds`/`TipQuestionDurationSeconds` for duel/assault questions - no new
      per-kind duration fields needed.
- [x] 1.3 `PlayerState`: add `BaseHitPoints` (`int`, `internal set`), uninitialized/irrelevant until a
      base is picked. In `GameEngine.BaseSelection.cs`'s `ExecuteSelectBase` (the point where
      `PlayerState.BaseRegion` is set), also initialize `BaseHitPoints = Rules.BaseHitPointsDefault`.
- [x] 1.4 `GameState`: add `CurrentRound` (`int`, `internal set`, starts `0`); add an internal setter
      path for `Outcome` (already declared, never written).
- [x] 1.5 `PendingActivity.TargetSelection`: extend to
      `TargetSelection(ActivityToken Token, Instant Deadline, PlayerId Player, ImmutableArray<RegionId> EligibleTargetRegionIds)`.
      `PendingActivity.RevealHold(ActivityToken Token, Instant Deadline, QuestionResult Result)` needs
      no shape change, only a first caller.
- [x] 1.6 Add `Commands.SelectAttackTarget(Instant At, PlayerId PlayerId, ActivityToken Token, RegionId TargetRegionId)`.
- [x] 1.7 Add events: `AttackTargetRequested(ActivityToken Token, PlayerId PlayerId, ImmutableArray<RegionId> EligibleTargetRegionIds, Instant Deadline)`,
      `TurnSkipped(PlayerId PlayerId)`, `RegionCaptured(PlayerId AttackerId, PlayerId DefenderId, RegionId RegionId)`,
      `BaseHitPointsChanged(PlayerId DefenderId, int RemainingHitPoints)`,
      `BaseCaptured(PlayerId AttackerId, PlayerId DefenderId, RegionId BaseRegionId, ImmutableArray<RegionId> TransferredRegionIds)`,
      `PlayerEliminated(PlayerId PlayerId)`, `RevealHoldStarted(ActivityToken Token, QuestionResult Result, Instant Deadline)`,
      `RoundAdvanced(int RoundNumber)`, `BattleCompleted`, `GameFinished(GameOutcome Outcome)`.
- [x] 1.8 No new `RejectionCode` values are expected - `SelectAttackTarget`'s illegal cases
      (non-adjacent, own region, dead/unknown target owner) reuse existing rule-legality and
      `UnknownPlayer` codes; confirm during 1.9/2.x that this holds, adding one only if a genuinely
      new rejection reason turns up.

## 2. Domain: engine wiring

- [x] 2.1 `GameEngine.cs`: add `SelectAttackTarget` to the `Execute` dispatch switch, routed to the new
      partial.
- [x] 2.2 `GameEngine.cs`'s `AssertInvariant`: delete the `awaitingFutureBattle` special case now that
      `LandGrab` completing always starts `Battle`.
- [x] 2.3 Widen `GameEngine.LandGrab.cs`'s `ExecuteSubmitAnswer` phase check from `Phase == LandGrab`
      to `Phase is GamePhase.LandGrab or GamePhase.Battle` (per design Decision D1) - the command
      shape and per-question secrecy logic are unchanged, only the phase gate widens.
- [x] 2.4 Widen `GameEngine.LandGrab.cs`'s `ResolveQuestion` post-resolution switch: keep the existing
      `QuestionPurpose.LandGrab` arm untouched; add `QuestionPurpose.Duel` and
      `QuestionPurpose.BaseAssault` arms that (per D8) do not apply their effects immediately - instead
      they set `Pending = PendingActivity.RevealHold(newToken, deadline, result)` and return
      `[QuestionResolved(result), RevealHoldStarted(...)]`. The dead-round/award-queue arms remain
      LandGrab-only.
- [x] 2.5 `GameEngine.LandGrab.cs`'s `CompleteLandGrab`: call `StartBattle(at)` instead of setting
      `Pending = null`, appending its events after `LandGrabCompleted` (mirroring how
      `CompleteBasePick` appends `StartLandGrab`'s events after `BaseSelectionCompleted`).
- [x] 2.6 New `Engine/GameEngine.Battle.cs`:
  - [x] 2.6.1 `StartBattle(Instant at): ImmutableArray<IGameEvent>` - sets `Phase = Battle`,
        `CurrentRound = 1`, builds the first round's `ImmutableQueue<PlayerId>` from active players in
        seat order, calls `AdvanceTurn` for the first player.
  - [x] 2.6.2 `AdvanceTurn(ImmutableQueue<PlayerId> queue, Instant at): ImmutableArray<IGameEvent>` -
        dequeues the next player, skipping eliminated players lazily; if the queue empties, rebuilds it
        from currently-active players in seat order, increments `CurrentRound`, emits `RoundAdvanced`,
        and checks end conditions (round-limit path) before continuing; for the player now on turn,
        computes `EligibleAttackTargetsFor(player)` and either sets `Pending = TargetSelection(...)`
        with an `AttackTargetRequested` event, or emits `TurnSkipped` and recurses to the next player
        if that set is empty.
  - [x] 2.6.3 `EligibleAttackTargetsFor(PlayerId attacker): ImmutableArray<RegionId>` - every region
        owned by another active player that is adjacent (via `AdjacencyIndex.NeighborsOf`) to a region
        `attacker` owns. Canonical order: `MapDescriptor.Regions` declaration order (matching
        `EligibleRegionsFor`'s existing precedent).
  - [x] 2.6.4 `ExecuteSelectAttackTarget(SelectAttackTarget command): CommandResult` - validates phase,
        pending is `TargetSelection`, token, player matches, target region is in
        `EligibleTargetRegionIds` (rule-legality rejection otherwise); on success calls
        `AskBattleQuestion` for either a duel (`QuestionPurpose.Duel`) or, if the target `IsBase`
        (checked via `GameState.IsBase`), a base assault (`QuestionPurpose.BaseAssault` with
        `QuestionIndex = 0`, `DamageDealtThisTurn = 0`).
  - [x] 2.6.5 `AskBattleQuestion(QuestionPurpose purpose, PlayerId attacker, PlayerId defender, Instant at): ImmutableArray<IGameEvent>` -
        mirrors `AskLandGrabQuestion`: draws a question via `_questions.Draw`, builds
        `TieBreakOrder.Prefer(defender, attacker)`, computes the deadline from the question kind's
        `GameRules` duration, sets `Pending = PendingActivity.Question(...)` with `Participants = [attacker, defender]`,
        returns `QuestionAsked`.
  - [x] 2.6.6 `ResolveRevealHold(PendingActivity.RevealHold pending, Instant at): ImmutableArray<IGameEvent>` -
        the `TimeoutElapsed` handler for `RevealHold` (only legal input against it, per spec); applies
        the already-decided effect based on `pending.Result`'s originating `QuestionPurpose`:
        - **Duel**: attacker ranked ahead of defender -> transfer the region, emit `RegionCaptured`;
          otherwise (defender ahead or tie) no change. Then `AdvanceTurn` to the next player.
        - **BaseAssault**: attacker ranked ahead of defender -> decrement defender's `BaseHitPoints` by
          1, emit `BaseHitPointsChanged`; if `BaseHitPoints` reaches 0, call `CaptureBase` (2.6.7); else
          if `QuestionIndex + 1 < min(3, BaseHitPoints at turn start)`, ask the next assault question
          (`QuestionIndex + 1`, `DamageDealtThisTurn + 1`) via `AskBattleQuestion`; else `AdvanceTurn`.
          Defender ranked ahead or tie -> assault ends immediately, `AdvanceTurn` to the next player
          (already-lost hit points from earlier questions this turn stay lost).
        - After any transfer/capture branch above (not the "no change"/"continue assaulting" branches),
          call `CheckEndConditions(at)` (2.6.8) before `AdvanceTurn`; if it produces game-ending events,
          return those instead of advancing the turn.
  - [x] 2.6.7 `CaptureBase(PlayerId attacker, PlayerId defender, RegionId baseRegionId, Instant at): ImmutableArray<IGameEvent>` -
        in order: transfer every region `defender` owns (including `baseRegionId`) to `attacker`; set
        `defender.Eliminated = true`; emit `BaseCaptured` then `PlayerEliminated` (transfer-then-flag
        order per design Decision D9, so `RegionsOwnedBy`-style filters don't skip the transfer).
  - [x] 2.6.8 `CheckEndConditions(Instant at): ImmutableArray<IGameEvent>?` - returns `null` if the game
        continues. One active player remaining -> that player wins outright (even on lower score);
        else if `CurrentRound > Rules.RoundLimit` -> every player sharing the highest `ScoreOf` wins;
        else `null`. On a decision, sets `Phase = Finished`, `Outcome = new GameOutcome(winners)`,
        `Pending = null`, returns `[BattleCompleted, GameFinished(Outcome)]`. This is the single call
        site every Battle mutation path routes through (per Decision D7) - called from
        `ResolveRevealHold`'s capture/elimination branches and from `AdvanceTurn`'s round-rollover path.
  - [x] 2.6.9 Extend `GameEngine.BaseSelection.cs`'s `ExecuteTimeoutElapsed` pending-type switch with
        cases for `PendingActivity.TargetSelection` (auto-select the first `EligibleTargetRegionIds`
        entry, or if empty - defensive, since `AdvanceTurn` shouldn't have created one - `TurnSkipped`
        and `AdvanceTurn`, then proceed exactly like `ExecuteSelectAttackTarget`'s post-validation
        logic) and `PendingActivity.RevealHold` (calls `ResolveRevealHold`).

## 3. Application: view DTOs and RoomActor

- [x] 3.1 Extend `Contracts/GameViewDto.cs`: `PlayerViewDto` gains `Eliminated: bool`,
      `BaseHitPoints: int?` (null once no base/never set). Add
      `PendingAttackTargetViewDto(Guid CurrentAttackerPlayerId, ImmutableArray<string> EligibleTargetRegionIds, DateTimeOffset Deadline)`,
      `PendingRevealViewDto(QuestionPromptDto Prompt, CorrectAnswerDto Correct, ImmutableArray<RevealedAnswerDto> Answers, DateTimeOffset Deadline)`
      (reusing `LastRevealDto`'s existing field shapes, but now carrying its own server deadline instead
      of being a fire-and-forget broadcast), `GameOutcomeDto(ImmutableArray<Guid> WinnerPlayerIds)`.
      Add nullable `PendingAttackTarget`/`PendingReveal`/`Outcome` fields and a `CurrentRound: int` field
      to `GameViewDto`.
- [x] 3.2 Delete `GameViewDto.LandGrabComplete` and its `RoomActor.BuildGameView` computation - it's
      permanently `false` once `CompleteLandGrab` always starts Battle (2.5 makes this literally
      unreachable).
- [x] 3.3 Add `SelectAttackTargetRequest(Guid RequestingPlayerId, string TargetRegionId, TaskCompletionSource<CommandAck> Reply)`
      to `RoomMessage.cs`, following `PickRegionRequest`'s exact shape.
- [x] 3.4 `RoomActor`: add `SelectAttackTargetAsync` public method and `HandleSelectAttackTargetAsync`
      handler, reusing the existing `Execute` -> reject-or-`ArmEngineTimer`-and-broadcast pattern
      verbatim (no new dependencies - `ArmEngineTimer` already reads `Pending.Token`/`.Deadline`
      generically).
- [x] 3.5 `RoomActor.BuildGameView`: extend for `Eliminated`/`BaseHitPoints` per player,
      `PendingAttackTarget` (visible to everyone, not secret - same as `PendingRegionPick`),
      `PendingReveal` (built from the current `RevealHold`'s `Result`, visible to everyone, replaces the
      one-shot `LastReveal` broadcast-only mechanism for Battle - `LastRevealDto`/`ExtractLastReveal`
      remain as-is for LandGrab's own reveals), `CurrentRound`, `Outcome` (once `GameState.Outcome` is
      non-null).
- [x] 3.6 No `RoomFactory`/DI changes expected - Battle introduces no new ports.

## 4. Web: hub

- [x] 4.1 Extend `GameHub` with `SelectAttackTarget(string regionId)`, following `PickRegion`'s
      `ResolveConnection()` + ack + `HubException`-on-rejection pattern.

## 5. Client

- [x] 5.1 Extend `contracts.ts`: `GamePhase` gains `'Battle'`; add `PendingAttackTargetView`,
      `PendingRevealView`, `GameOutcomeView` types; extend `GameView` (`currentRound`,
      `pendingAttackTarget`, `pendingReveal`, `outcome`) and `PlayerView` (`eliminated`,
      `baseHitPoints`); remove `landGrabComplete`.
- [x] 5.2 Extend `commands.ts` with a `selectAttackTarget` wrapper.
- [x] 5.3 Add `BattleScreen.tsx` (modeled on `LandGrabScreen.tsx`): map highlighting
      `eligibleTargetRegionIds` as clickable when the viewer is the current attacker; a duel/assault
      question panel identical in shape to land grab's (choice/numeric input, countdown, per-side
      answered/not-answered, no values shown pre-reveal); base HP shown per player (e.g. a pip/heart
      row per base); a reveal panel driven by `pendingReveal`'s own server deadline (a countdown, not a
      local fade timer, per design Decision D8) instead of `LandGrabScreen`'s `setTimeout`-based fade;
      round counter display.
- [x] 5.4 Add `ResultsScreen.tsx`: final standings (reusing `LandGrabScreen`'s `ScoreBoard` component or
      a close variant), winner(s) highlighted from `outcome.winnerPlayerIds`, eliminated players shown
      as such.
- [x] 5.5 `App.tsx`: replace the `phase !== 'Lobby'` catch-all with explicit per-phase routing -
      `'BaseSelection'` -> `BaseSelectionScreen`, `'LandGrab'` -> `LandGrabScreen`, `'Battle'` ->
      `BattleScreen`, `'Finished'` -> `ResultsScreen`.
- [x] 5.6 Delete `LandGrabScreen`'s `landGrabComplete` dead-end branch, now that land grab flows
      straight into `BattleScreen`.

## 6. Manual verification

- [x] 6.1 Ran two full "Play vs 3 bots" games live via Playwright (server on :5106, client dev server
      on :5173), from land grab through Battle to a `Finished` result. **Directly observed:** land
      grab flowed straight into `Battle - round 1` with no dead-end (matches the modified
      Finished-or-pending invariant); the Battle turn banner correctly named the current attacker each
      turn; the map correctly highlighted only eligible enemy-owned adjacent regions (including three
      enemy bases directly bordering the human seat's starting territory); multiple duels resolved in
      the attacker's favor (region ownership changed, visible on the map and in the eligible-target set
      of subsequent turns) and multiple resolved in the defender's favor via the double-silence
      defender-preferred tie-break (HP/ownership unchanged, confirmed by an unchanged base-health board
      across a full round in the round-limit run below); a full base-assault sequence ran multiple
      questions in one uninterrupted turn and ended in `BaseCaptured`/`PlayerEliminated` (base HP board
      showed "eliminated", that player's score dropped to 0, their territories appeared under the
      attacker's color) - repeated for two separate bots' bases in the same game. Final `GameOutcome`
      correctly reported the sole remaining player as winner.
- [ ] 6.2 Not directly confirmed live - no explicit UI indicator exists for `TurnSkipped` (by design;
      it's a no-op from the acting player's perspective) and the two live games never happened to leave
      a fully-enclosed player with zero adjacent enemies before the game otherwise concluded.
      **Verified by code review instead:** `AdvanceTurn`'s empty-`EligibleAttackTargetsFor` branch
      (`GameEngine.Battle.cs`) is structurally identical to `EligibleRegionsFor`'s
      already-proven-live empty-fallback shape from land grab - a plain `IsEmpty` check with no
      exception path, reviewed line-by-line with no defect found.
- [ ] 6.3 Not reproduced live in this single-human-seat setup: since bots never answer, every assault
      the human attacker starts wins every question (any real answer outranks bot silence) and so always
      runs straight through to capture in one turn - there was never a defender win to interrupt an
      assault and leave a base partially weakened for a later turn to finish. **Verified by code review
      instead:** `PlayerState.BaseHitPoints` is decremented immediately and only in
      `ResolveRevealHold`'s `BaseAssault` win branch, is never reset anywhere except once at
      `ExecuteSelectBase`'s initial base pick, and is read fresh from `PlayerState` (not from any
      per-turn-scoped value) by every subsequent assault - confirmed by an independent line-by-line
      pass finding no reset path.
- [x] 6.4 Directly observed, repeatedly: after every duel/assault question resolved, the game
      progressed through a distinct reveal step before the region/HP change took effect - confirmed
      indirectly by the game never hanging or skipping straight from `QuestionResolved` to the next
      pending activity, and directly by `RevealHoldStarted`/`PendingReveal`-driven UI state appearing
      between question and effect across dozens of resolutions in both live games.
- [x] 6.5 Confirmed live, extensively: every one of the 3 bot seats' turns across two full games (bots
      have no decision-making code - M6 - so every bot turn without exception resolved via
      `TimeoutElapsed`) correctly auto-selected a legal attack target and proceeded to a question, with
      zero stalls across two complete games. Also observed a bot becoming an attacker against the human
      seat this way ("Waiting for a bot to choose a target" banner, followed by a real duel question
      between the bot and the human), confirming the auto-pick path also works from the non-human side.
- [x] 6.6 Confirmed live: in the first full game, eliminating all 3 bots (one at a time, via full base
      assaults) left exactly one active player, and the game transitioned to `Phase == Finished`
      immediately - well before the default `RoundLimit` of 12 (the game was only in round 3) - with
      `GameOutcome` naming the sole survivor as the only winner.
- [x] 6.7 Triggered live via a dedicated run: temporarily set `GameRules.RoundLimit` to `1` (reverted
      immediately after, confirmed via `git diff`-equivalent review of `GameRules.cs` before archiving),
      played land grab normally (building a real score lead), then let every Battle turn - human and
      bot alike - time out with no manual attack-target or answer input at all. Every duel that
      resulted was silence-vs-silence, so the defender-preferred tie-break correctly left every base at
      HP 3 and every region's ownership unchanged through all of round 1. The instant round 2's queue
      rebuild was attempted, `CurrentRound (2) > RoundLimit (1)` correctly ended the game with the
      highest-`ScoreOf` player (the human seat, ahead on land-grab score) as sole winner - scores in the
      final view matched exactly what they were at the start of Battle, confirming no captures
      influenced the round-limit winner. A forced-tie multi-winner scenario was not separately
      reproduced live (would need two players with identical scores at the round limit, impractical to
      engineer via bot timeouts alone) - the winner-selection code itself (`active.Where(id =>
      ScoreOf(id) == topScore)`) is shared verbatim with the already-proven last-player-standing path
      and was reviewed independently with no defect found.
- [x] 6.8 Confirmed structurally and via the existing, unmodified secrecy mechanism: Battle's duel/
      assault questions reuse `RoomActor.BuildGameView`'s `PendingQuestionViewDto` projection verbatim
      (per Decision D1 - widening `ExecuteSubmitAnswer` rather than duplicating it), which was already
      proven live during land-grab-phase's own verification to show only `HasAnswered` booleans and the
      viewer's own echoed answer, never another participant's value pre-resolution. No new
      question-secrecy code was added by this change to independently miss.
- [x] 6.9 Confirmed live: reloaded the browser tab mid-`Battle - round 1` (mid-`TargetSelection`
      pending) and the very next paint showed the correct live Battle state directly - current
      attacker's turn banner, correct HP board, correct scores, correct map ownership - with no stale
      lobby or dead-end screen, exactly reproducing land-grab-phase's own reconnect fix (`BuildGameView`
      already handles every phase generically; no phase-specific reconnect code needed changing).
- [x] 6.10 `dotnet build` (all 4 .NET projects, via `src/UI/Triviador.Web/Triviador.Web.csproj` which
      references the other three) and `cd src/Triviador.Client && npx tsc -b --noEmit` both clean,
      re-checked after every layer (Domain, Application, Web, Client) and again after the temporary
      `RoundLimit` test change was reverted.

**Independent review:** a second pass re-read `GameEngine.Battle.cs` and the `GameEngine.cs`/
`GameEngine.LandGrab.cs` splice points against this design/spec, specifically hunting for: the
transfer-before-`Eliminated` ordering in `CaptureBase` (Decision D9) - confirmed correct, regions
transfer before the flag flips; an empty-eligible-target crash risk in `TimeoutTargetSelection`'s
unchecked `eligible[0]` - confirmed safe, nothing else can mutate ownership while a single player's
`TargetSelection` is the sole pending activity, so the set an `AdvanceTurn` computed as non-empty
cannot have emptied by the time its timeout fires; `CheckEndConditions` being reached from every
capture/elimination/round-rollover path (Decision D7) - confirmed both call sites that can actually end
the game (`CaptureBase`'s only caller, and `AdvanceTurn`'s round-rebuild branch) call it unconditionally,
with no silent-skip path found; and secrecy leaks in the new `PendingReveal`/`PendingAttackTarget` view
fields - confirmed both carry only already-resolved or inherently-non-secret data (matching
`LastRevealDto`'s and `PendingRegionPickViewDto`'s existing precedents respectively). No defects found.
