## 1. Domain: self-heal by targeting your own base

- [x] 1.1 In `GameEngine.Battle.cs`, extend `EligibleAttackTargetsFor` to append the attacker's own
      base region when `BaseAssaultsUnlocked()` and their `BaseHitPoints < GameRules.
      BaseHitPointsDefault`, after the existing enemy-target list (keep `Map.Regions` declaration
      order for the enemy list; the self-base entry is a single deterministic append).
- [x] 1.2 In `AskBattleQuestion`, branch on `attacker == defender`: build `Participants` as
      `ImmutableArray.Create(attacker)` (not a duplicate two-element array) for the self case, keeping
      the existing two-element behavior otherwise.
- [x] 1.3 In `ResolveRevealHold`'s `QuestionPurpose.BaseAssault` branch, add an
      `assault.Attacker == assault.Defender` branch: read the single participant's `RankedAnswer` and
      treat `Tier == 0 && Penalty == 0` as success; on success, `BaseHitPoints = Math.Min(BaseHitPoints
      + 1, GameRules.BaseHitPointsDefault)` and emit the existing `BaseHitPointsChanged` event; either
      way, call `AdvanceTurn(at)` directly (no `CheckEndConditions()`) and return - do not fall through
      to the existing damage/chain logic.
- [x] 1.4 Confirm (by reading, no code change expected) that `ResolveQuestion`/`AnswerRanker.Rank` in
      `GameEngine.LandGrab.cs` already handle a 1-element `Participants` array correctly for the
      self-heal question.

## 2. Application: explicit mid-game leave and bot takeover

- [x] 2.1 In `RoomActor.HandleLeaveAsync`, branch on `_engine is null`: keep the existing
      `seat.Clear()` path for the lobby; for a started game, instead set `seat.IsBot = true` and
      `seat.ConnectionId = null` while leaving `PlayerId`/`DisplayName`/`PlayerToken` untouched.
- [x] 2.2 After the mid-game takeover branch, call `ScheduleBotMoves(_engine.State.Pending)` (guarding
      for `_engine.State.Pending is not null`) so a currently-pending activity for the leaving player
      gets a bot move scheduled immediately, then `BroadcastAsync`/`BroadcastGameViewAsync` as
      appropriate so every other seat sees the updated (now-bot) seat state.
- [x] 2.3 Confirm host-reassignment logic in `HandleLeaveAsync` still behaves sensibly mid-game (a
      leaving host mid-game has no seats left to toggle anyway, since bot-toggling is already locked
      once the game starts - verify no regression here).

## 3. Client: leave-game affordance

- [x] 3.1 Add a "Leave game" action to `App.tsx`'s `TopBar` (next to `MuteToggle`), visible whenever
      `gameView` is present and `gameView.phase !== 'Finished'` (Results already has its own leave
      button).
- [x] 3.2 Gate the action behind a confirmation prompt; on confirm, call `leaveRoom()` then
      `setSession(null)`, matching the existing `ResultsScreen.onLeave` pattern.
- [x] 3.3 Add `en`/`ru` i18n strings for the new action and its confirmation copy.

## 4. Client: territory- and base-under-attack visual/audio effects

- [x] 4.1 In `App.css`, add an escalated "under attack" keyframe/class for a contested region (a
      stronger pulse/glow than the existing `.contested-marker`/`contested-pulse`), and a further,
      distinctly more intense variant for the viewer's own base under assault; add both to the
      existing `prefers-reduced-motion: reduce` block with a static (non-animated) equivalent.
- [x] 4.2 Wire the escalated contested-region class into `RegionShape.tsx`/`GameMap.tsx`, keyed off
      `view.battle` (only when `battle.attackerPlayerId !== battle.defenderPlayerId` - excluding the
      calm self-heal case).
- [x] 4.3 Add an `underAttack` prop to `WaxSeal.tsx` and pass it from `GameMap.tsx` when
      `view.battle?.kind === 'BaseAssault' && battle.defenderPlayerId === view.youPlayerId &&
      battle.attackerPlayerId !== battle.defenderPlayerId`; render the escalated own-base effect from
      it.
- [x] 4.4 Extend the existing map-shake wiring (`App.tsx`'s `mapShaking` state / `AppShell`) so the
      viewer's own base being under assault sustains a (calmer than the post-hit shake) danger
      indicator for the assault's duration, without replacing the existing edge-triggered
      `baseDamaged` shake.
- [x] 4.5 Add a `playAttackStarted()` cue to `lib/sound.ts` (same `tone()`-based synthesis approach as
      `playCorrect`/`playIncorrect`), respecting the existing mute flag.
- [x] 4.6 Fire `playAttackStarted()` from `BattleScreen.tsx`'s `BattleDock` in a `useEffect` keyed on a
      value that changes only when a genuinely new duel/enemy-assault target begins (e.g.
      `` `${battle.attackerPlayerId}:${battle.defenderPlayerId}:${battle.contestedRegionId}` `` without
      `assaultQuestionIndex`, so a chained assault question against the same target does not replay
      it), skipping entirely when `attackerPlayerId === defenderPlayerId`.
- [x] 4.7 Update `battleHeadline` in `BattleScreen.tsx` with distinct copy for the self-heal case
      (attacker and defender the same player) versus a duel/enemy assault.

## 5. Verification

- [x] 5.1 `dotnet build` and `cd src/Triviador.Client && npx tsc -b --noEmit` both pass.
- [ ] 5.2 Manually play a 4-tab game to Battle phase: verify a damaged base can be self-targeted (and
      a full-HP base cannot), a correct answer heals 1 HP capped at the default max, and an
      incorrect/timeout answer changes nothing. **Not reached live** - self-heal only becomes eligible
      once `BaseAssaultsUnlocked()` (round 8+ of the default 12-round limit); a live Playwright session
      can't outrun that many real per-question countdowns (see `feedback_playwright_latency` memory).
      Verified instead by careful code tracing of `EligibleAttackTargetsFor`/`AskBattleQuestion`/
      `ResolveRevealHold` against `AnswerRanker`/`AnswerEvaluator`'s actual Tier/Penalty semantics.
- [x] 5.3 Manually verify: leaving mid-game via the new action converts the seat to a bot that keeps
      playing (including finishing out a turn you were mid-way through), while a plain dropped
      connection (closing a tab without leaving) still only shows as disconnected. **Verified live**:
      2-tab Playwright session, host left during their own pending base pick, confirm dialog showed
      the expected copy, the seat's base was picked by a bot immediately (no timeout wait), and the
      game continued normally to Land Grab/Battle with the second human player unaffected.
- [ ] 5.4 Manually verify the escalated contested-region effect and sound cue on a regular duel and an
      enemy-base assault, the further-escalated own-base effect when your own base is the assault
      target, and that none of the new effects/cue play during a self-heal. **Partially verified
      live**: reached a real Battle-phase duel and confirmed via DOM inspection that the contested
      region rendered with both `contested-marker` and `contested-marker-escalated` classes (the
      sound cue fires off the same key, confirmed by code path, not by ear). The enemy-base-assault/
      own-base/self-heal-exclusion cases are round-8+-gated like 5.2 and were verified by code review
      only, not live play.
- [ ] 5.5 Toggle OS-level `prefers-reduced-motion` and confirm every new animated effect collapses to
      its static equivalent per `client-presentation`. **Not exercised** - no OS-level reduced-motion
      toggle available in this environment/MCP tool surface; the new rules were added to the existing
      `@media (prefers-reduced-motion: reduce)` block following the same pattern already used by every
      other animation in `App.css`, reviewed by inspection rather than emulated.
