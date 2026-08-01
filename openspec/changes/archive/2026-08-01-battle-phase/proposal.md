## Why

Land grab (`land-grab-phase`) fills the map but explicitly stops there: `LandGrabCompleted` leaves
`Phase == LandGrab` with `Pending == null` — a documented, temporary exception to the
"Finished-or-pending" invariant, the same way `start-game-and-base-selection` once left
`BaseSelection` at a dead end until land grab closed it. Nothing after land grab exists yet: no
turn-based combat, no way to eliminate a player, no way for the game to actually end. This is M5 in
the project plan ("Full rules") — the last milestone that turns Triviador from "fills a map" into
"a game with a winner" — and every domain type it needs (`QuestionPurpose.Duel`,
`QuestionPurpose.BaseAssault`, `PendingActivity.TargetSelection`, `PendingActivity.RevealHold`,
`GameState.Outcome`, `PlayerState.Eliminated`, `TieBreakOrder.Prefer`) was already declared by
earlier changes specifically so this one could consume them, and has sat with zero writers since.

## What Changes

- Add `GamePhase.Battle` between `LandGrab` and `Finished`, and close the `LandGrab`/`Pending == null`
  gap: `CompleteLandGrab` starts Battle instead of leaving the game waiting on nothing, mirroring
  exactly how `CompleteBasePick` starts land grab today. Delete the now-satisfied
  `awaitingFutureBattle` special case from `GameEngine.cs`'s `AssertInvariant`.
- Turn machine: a round is one full cycle of every surviving player taking one attack turn, driven by
  an `ImmutableQueue<PlayerId>` rebuilt from active players in seat order at the start of each round
  (never index into a mutable active-player list — eliminations mutate it mid-round). A player with no
  legal target emits `TurnSkipped` and passes without spending a question. `GameRules.RoundLimit`
  (declared, currently read by nothing) becomes load-bearing: the game ends after that many rounds.
- Regular duels: the player on turn picks one enemy region adjacent to a region they own
  (`PendingActivity.TargetSelection`, extended with the eligible-target list following
  `PendingActivity.RegionPicks`'s precedent, and a new `SelectAttackTarget` command mirroring
  `PickRegion`'s shape); attacker and defender both answer one question, reusing the existing
  phase-agnostic `Question` pending activity, `AnswerRanker`, and `SubmitAnswer`/`QuestionAsked`/
  `QuestionResolved` verbatim, with `QuestionPurpose.Duel` and `TieBreakOrder.Prefer(defender,
  attacker)` (declared, unused today) so a surviving tie always favors the defender per
  `answer-ranking`'s existing, already-normative spec text. The better answer takes the region; a draw
  or double-timeout is a defender win; a failed attack costs the attacker nothing.
- Base assault: attacking an enemy's base runs up to `min(3, defender's current base HP)` questions in
  one turn via `QuestionPurpose.BaseAssault` (already shaped with `QuestionIndex`/
  `DamageDealtThisTurn`). Base HP is new persistent, global state on `PlayerState` (never on
  `RegionState` — a captured base stops needing HP entirely) that never regenerates: a base weakened
  by one attacker stays weakened for whoever assaults it next. Each attacker win removes 1 HP
  immediately; any defender win ends the assault immediately with damage so far retained. At 0 HP the
  attacker takes the base plus every region that player owned, that player becomes `Eliminated`
  (declared on `PlayerState`, never set today), and the base becomes a normal territory worth its
  existing map `Value` — the conqueror does not inherit the 1000-point base bonus. Capture order is
  transfer regions → set `Eliminated` → emit → check end conditions → end turn, so `Eliminated` never
  short-circuits the transfer it depends on.
- End conditions, checked after every capture: the game ends immediately with one player remaining
  (the survivor wins even on fewer points) or after `RoundLimit` rounds, whichever comes first;
  otherwise the highest `GameState.ScoreOf` score wins, with equal top scores reported as every tied
  player winning. Sets the previously-unwritten `GameState.Outcome` and transitions to
  `GamePhase.Finished`.
- Implement `PendingActivity.RevealHold` for real (declared, unused today) — Battle's reveals run
  through the timer machinery like every other pending activity instead of a client-side fade timer,
  per the plan's cross-layer contract #5 and M5's explicit scope. Land grab's already-shipped,
  already-verified client-side fade timer is left exactly as it is (see Non-Goals) — this is a new
  mechanic for Battle's reveals, not a retrofit of working code.
- `GameRules` gains every new tunable this introduces: attack-target-selection duration, base starting
  HP, reveal-hold duration. No hardcoded constants land in the engine.
- `TimeoutElapsed` handling for every new pending-activity shape (`TargetSelection` auto-picks a legal
  target, or the turn is skipped if none exist; `RevealHold`'s timeout simply advances the pump) — a
  stale token stays a harmless no-op, per the existing, unconditional invariant.
- `RoomActor`/`GameHub`/client wiring for `SelectAttackTarget` and the new Battle/reveal/results view
  state, following the exact `Execute` → `ArmEngineTimer` → broadcast pattern and the exact secrecy
  rules (never another player's in-flight answer, `HasAnswered` booleans only) already established by
  land grab's `SubmitAnswer`/`PickRegion` handlers.
- A `ResultsScreen` on the client, shown when `phase === 'Finished'`, rendering final standings and
  the winner(s) from `GameOutcome`.

## Capabilities

### New Capabilities
- `battle-flow`: the Battle phase end to end — turn order and skip-on-no-target, duel target
  selection and resolution, base assault's up-to-3-question sequence and persistent HP, capture and
  elimination, end-of-game conditions and `GameOutcome`, and `RevealHold`'s timer-driven reveal
  pacing.

### Modified Capabilities
- `game-setup-rules`: the "Finished-or-pending" invariant's remaining documented exception
  (`LandGrab` completing with `Pending == null`) is removed — the invariant becomes unconditional
  again; `Battle` and its new pending-activity shapes join the legal-commands table.

## Impact

- `Triviador.Domain`: new `GameEngine.Battle.cs` partial; edits to `GameEngine.cs` (dispatch switch,
  invariant), `GameEngine.LandGrab.cs` (`CompleteLandGrab`'s transition); new/extended
  `PendingActivity`, `QuestionPurpose` usage (types already exist); `GameRules`, `PlayerState`
  (base HP field), `GameState` (round counter, `Outcome` writer), `Commands`/`Events` additions.
- `Triviador.Application`: `RoomMessage.cs` (`SelectAttackTargetRequest`), `RoomActor.cs` (new
  handler + `BuildGameView` extensions), `GameViewDto.cs` and friends (new nullable view fields,
  `Eliminated` on `PlayerViewDto`, an outcome/winners field).
- `Triviador.Infrastructure`: none expected — no new ports.
- `src/UI/Triviador.Web`: `GameHub.cs` (`SelectAttackTarget` RPC).
- `src/Triviador.Client`: `contracts.ts`/`commands.ts` additions; new `BattleScreen.tsx` and
  `ResultsScreen.tsx`; `App.tsx` phase routing extended per-phase instead of relying on the current
  `!== 'Lobby'` catch-all.
