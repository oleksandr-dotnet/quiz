## 1. Domain: self-heal keeps the turn on success

- [x] 1.1 In `GameEngine.Battle.cs`, factor `AdvanceTurn`'s "build a `TargetSelection` for a player
      from a known-non-empty eligible list" tail (lines 63-66) into a new private
      `IssueTargetSelection(PlayerId player, ImmutableArray<RegionId> eligible, Instant at)` helper,
      and call it from `AdvanceTurn`'s loop instead of inlining it.
- [x] 1.2 Add a new private `ContinueTurnFor(PlayerId player, Instant at)` helper: recompute
      `EligibleAttackTargetsFor(player)`; if empty, return `AdvanceTurn(at)`; otherwise return
      `IssueTargetSelection(player, eligible, at)`.
- [x] 1.3 In `ResolveRevealHold`'s `QuestionPurpose.BaseAssault assault when assault.Attacker ==
      assault.Defender` branch, hoist the existing success check into a `healed` boolean, and change
      the tail from unconditionally calling `AdvanceTurn(at)` to
      `events.AddRange(healed ? ContinueTurnFor(assault.Attacker, at) : AdvanceTurn(at));`.
- [x] 1.4 Update the comment on this branch to describe the new turn-retention behavior (a correct
      heal keeps the turn and may chain further heals or lead into an attack; an incorrect/inexact/
      missed answer still ends the turn).

## 2. Domain: base-assault chain documentation correction (no behavior change)

- [x] 2.1 Reword the comment at `GameEngine.Battle.cs` lines 266-270 (currently framing the lack of a
      cap as an incidental consequence of `BaseHitPointsDefault`) to state plainly that a base-assault
      chain has no fixed per-turn question limit - it continues until the attacker fails or the base's
      hit points reach zero, whichever comes first.
- [x] 2.2 Confirm (by reading, no logic change expected) that no other code path - `RoomActor.cs`'s
      battle-context projection, `BattleContextDto`, or the client's `BattleScreen.tsx` - assumes a
      fixed maximum chain length; `AssaultQuestionIndex`/`DamageDealtThisTurn` are already unbounded
      counters.

## 3. Domain: fixed round-8 unlock threshold

- [x] 3.1 In `GameRules.cs`, remove `BaseAssaultFinalRoundsWindow` and add `BaseAssaultUnlockRound`
      with default `8`.
- [x] 3.2 In `GameEngine.Battle.cs`, change `BaseAssaultsUnlocked()` to
      `_state.CurrentRound >= _state.Rules.BaseAssaultUnlockRound`, and update its preceding comment
      to describe the fixed-round rule instead of the relative "final rounds window" framing.
- [x] 3.3 Confirm `GameRules.Marathon` (and any other named ruleset) needs no override - it should
      inherit `BaseAssaultUnlockRound = 8` from `Default` and unlock at the same fixed round as every
      other ruleset.

## 4. Spec text

- [x] 4.1 In `openspec/changes/2026-08-03-fix-base-assault-rules/specs/battle-flow/spec.md` (this
      change's delta - already drafted), confirm the `MODIFIED`/`ADDED` requirement blocks read
      correctly against the final code.
- [x] 4.2 During apply, also hand-edit the Purpose paragraph at the top of
      `openspec/specs/battle-flow/spec.md` (not a delta requirement) to drop the
      "up-to-three-question assaults" phrase, replacing it with wording that matches the corrected,
      uncapped chain behavior.

## 5. Verification

- [x] 5.1 `dotnet build` passes (0 warnings, 0 errors).
- [x] 5.2 Verified by code trace: `ResolveRevealHold`'s enemy-assault branch (lines 269-309) is
      unchanged logic - on an attacker win it always recurses into `AskBattleQuestion` with the same
      attacker/defender and an incremented counter, with no cap check anywhere in the path, ending
      only on `defender.BaseHitPoints <= 0` (capture) or the `else` (defender win/tie, `AdvanceTurn`).
      This was already the pre-existing behavior; this change only corrected the stale comment/spec
      text describing it.
- [x] 5.3 Verified by code trace: `ResolveRevealHold`'s self-heal branch (lines 242-267) now computes
      `healed` once and calls `ContinueTurnFor(assault.Attacker, at)` on success (re-offers a target
      selection - another self-heal if `BaseHitPoints < BaseHitPointsDefault`, otherwise whatever
      enemy targets `EligibleAttackTargetsFor` returns, or `AdvanceTurn` if none) versus `AdvanceTurn`
      directly on failure. `EligibleAttackTargetsFor`'s self-heal inclusion (line 111) already keys off
      live `BaseHitPoints`, so a full-health base drops out automatically on the next call - no stale
      eligibility to manage.
- [x] 5.4 Verified by code trace: `BaseAssaultsUnlocked()` is now `_state.CurrentRound >=
      _state.Rules.BaseAssaultUnlockRound`, and `GameRules.Marathon` (`Default with { RoundLimit = 30
      }`) does not override `BaseAssaultUnlockRound`, so it inherits `8` from `Default` - both
      rulesets unlock at round 8, confirmed by inspecting `GameRules.cs`'s record definition (no
      per-field override needed since `with` only touches `RoundLimit`).
