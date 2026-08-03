## Context

Grounded in the current code, all in `GameEngine.Battle.cs` and `GameRules.cs`:

- **Base-assault chain has no cap today, contrary to the archived/current spec text.**
  `ResolveRevealHold`'s `QuestionPurpose.BaseAssault` branch (not the self-heal one - lines
  247-288) already recurses into `AskBattleQuestion` with an incremented `QuestionIndex`/
  `DamageDealtThisTurn` whenever the attacker wins and the base's hit points are still above zero
  (lines 264-277), with no counter checked against 3 or any other fixed number anywhere in that
  path. The inline comment at lines 266-270 already says as much ("the rule's 'up to 5 questions'
  cap is automatically satisfied by 'keep going until HP hits 0', with no separate counter
  needed"). The only place a "three questions" limit exists is `openspec/specs/battle-flow/spec.md`
  itself (`### Requirement: A base assault runs up to three questions...`, and the matching
  scenario text) - stale documentation from an earlier hit-point default, never updated when
  `BaseHitPointsDefault` became 5 and the cap-by-remaining-HP behavior shipped. This proposal is
  mostly a **documentation correction** for the chain-length behavior, not a code change - the one
  real code touch is rewording the comment at lines 266-270 so it no longer references a "5-question
  cap" as though it were a coincidence.
- **Self-heal always ends the turn today, by design at the time it was added** (see
  `2026-08-02-leave-game-and-combat-ux`'s design.md, "No multi-question self-heal chain" - a
  deliberate non-goal at the time, since a chained self-heal was judged "a strictly-better-than-
  attacking option with no offsetting risk"). `ResolveRevealHold`'s self-heal branch (lines
  225-245) computes `healed` from the single ranked answer's `Tier`/`Penalty`, applies the +1 HP on
  success, and then unconditionally calls `AdvanceTurn(at)` (line 243) regardless of `healed`. This
  proposal reverses that non-goal on explicit request: a correct heal now keeps the turn.
- **Round-gating today** (`BaseAssaultsUnlocked()`, lines 104-105): `_state.CurrentRound >
  _state.Rules.RoundLimit - _state.Rules.BaseAssaultFinalRoundsWindow`, called from both
  `EligibleAttackTargetsFor`'s enemy-base filter (line 85) and its self-heal-target inclusion (line
  94) - a single choke point, so changing its formula covers both cases for free. With defaults
  (`RoundLimit = 12`, `BaseAssaultFinalRoundsWindow = 5`) this unlocks at `CurrentRound > 7`, i.e.
  round 8 - numerically what's wanted, but expressed as "last 5 rounds of whatever the round limit
  is" rather than "round 8 always". `GameRules.Marathon` (`RoundLimit = 30`) would only unlock at
  round 26 under the current formula. No spec requirement documents this threshold at all today -
  grepping `openspec/specs/battle-flow/spec.md` for "unlock"/"round" gating language finds nothing;
  it has only ever lived in code.
- **Turn-continuation machinery**: `AdvanceTurn` (lines 26-69) is the only place that dequeues the
  next player from `_state.RoundQueue` and issues a fresh `TargetSelection`. Its loop body (lines
  56-67) computes `EligibleAttackTargetsFor(next)`, emits `TurnSkipped` and `continue`s if empty, or
  builds a `TargetSelection` pending activity and returns. There is currently no way to "give the
  same player another target selection without dequeuing anyone" - exactly what a chained self-heal
  needs.
- **Bot AI has no special-cased assumption to unwind.** Grepping
  `src/Triviador.Application/Hosting/BotChoice.cs` for `TargetSelection`/`BaseAssault`/`SelfHeal`/
  `BaseHitPoints` finds nothing - a bot's target choice is driven generically off whatever
  `EligibleAttackTargetsFor` (via the projected eligible-target list) currently offers, each time a
  fresh `TargetSelection`/`AttackTargetRequested` is issued. A repeated `TargetSelection` for the
  same bot player (from a chained self-heal or an unbounded assault re-question) is handled the same
  way as any other `TargetSelection` - no bot code needs to change.

## Goals / Non-Goals

**Goals:**
- Base-assault chains against an enemy base have no fixed per-turn question limit - only a tie or a
  defender win stops the chain. (Already true in code; this makes it the documented rule.)
- A correct self-heal keeps the turn: the player may heal again (if still damaged) or attack, all in
  the same turn. Only an incorrect/inexact/missed self-heal answer passes the turn.
- Base assaults (enemy or self-heal) unlock at a fixed round 8, independent of `GameRules.RoundLimit`
  or which ruleset is active.

**Non-Goals:**
- No change to the attacker-vs-enemy assault damage/capture logic itself (lines 247-288) - it
  already behaves as wanted; only its documentation and its surrounding comment change.
- No change to duel resolution, capture-on-zero-HP, tie-break rules, `RevealHold` timing, or any DTO/
  projection shape - `BattleContextDto`'s `AssaultQuestionIndex`/`DamageDealtThisTurn` already
  generalize over any chain length with no assumed maximum, and the client's HP display/animations
  already handle any HP value.
- No change to how a self-heal target is computed (still `BaseHitPoints < BaseHitPointsDefault`,
  still appended after enemy targets in `EligibleAttackTargetsFor`) - only what happens *after* a
  self-heal resolves.
- Reversing the prior change's "no chain" non-goal for self-heal is an explicit, requested behavior
  change here, not an oversight in that change - see its design.md rationale, now superseded.

## Decisions

### The chain-length change is a documentation fix, not a logic change
`ResolveRevealHold`'s attacker-vs-enemy `BaseAssault` branch keeps recursing into `AskBattleQuestion`
on every attacker win until hit points reach zero or the defender wins - this is already unbounded.
The only edits here: reword the comment at lines 266-270 to state plainly that the chain has no
fixed cap (rather than framing "no separate counter needed" as if a cap were the default
expectation), and rewrite `openspec/specs/battle-flow/spec.md`'s matching requirement/scenarios to
describe "continues until the attacker fails or the base falls" instead of "up to three questions".

### Self-heal turn-retention needs a new "continue this player's turn" primitive, factored out of `AdvanceTurn`
`AdvanceTurn`'s loop body builds a `TargetSelection` pending activity from a player and their
(already known non-empty) eligible-target list (lines 63-66). Factor that construction into a small
private helper:

```csharp
private ImmutableArray<IGameEvent> IssueTargetSelection(PlayerId player, ImmutableArray<RegionId> eligible, Instant at)
{
    var token = _state.IssueActivityToken();
    var deadline = at.Add(TimeSpan.FromSeconds(_state.Rules.AttackTargetSelectionDurationSeconds));
    _state.Pending = new PendingActivity.TargetSelection(token, deadline, player);
    return ImmutableArray.Create<IGameEvent>(new AttackTargetRequested(token, player, eligible, deadline));
}
```

`AdvanceTurn`'s loop body calls this instead of inlining it. A new sibling helper handles the
"same player continues, no dequeue" case a chained self-heal needs:

```csharp
private ImmutableArray<IGameEvent> ContinueTurnFor(PlayerId player, Instant at)
{
    var eligible = EligibleAttackTargetsFor(player);
    return eligible.IsEmpty ? AdvanceTurn(at) : IssueTargetSelection(player, eligible, at);
}
```

`EligibleAttackTargetsFor` is already re-derived fresh every call (no cached/stale eligible list), so
calling it again right after a heal naturally drops the self-heal option once the base reaches full
health and includes any enemy target the healer can now also reach - no separate re-evaluation logic
needed. If the player has become fully healed *and* has no adjacent enemy territory (fully isolated,
maxed-out base), `ContinueTurnFor` falls through to `AdvanceTurn`, which correctly moves on to
whichever player is actually next in the queue - not a `TurnSkipped` for the healer, since they did
act this turn (they just have nothing left to do with the rest of it).

`ResolveRevealHold`'s self-heal branch (lines 225-245) changes from unconditionally calling
`AdvanceTurn(at)` to:

```csharp
events.AddRange(healed ? ContinueTurnFor(assault.Attacker, at) : AdvanceTurn(at));
```

where `healed` is the existing boolean already computed from `score is { Tier: 0, Penalty: 0 }` (just
hoisted out of the `if` so both branches can read it).

- Alternative considered: give the attacker-vs-enemy assault path and the self-heal path a single
  shared "continue or end" helper. Rejected - the enemy-assault path's continuation logic is about
  the *same fixed target* (`nextPurpose` re-asks the same base with an incremented counter), while
  self-heal's continuation is a fresh *target selection* (the player picks again, possibly a
  different target) - these are different enough in shape that sharing one helper would need a
  branch inside it anyway, adding indirection for no real deduplication.

### Round-gating becomes an absolute round, replacing the relative window tunable
`GameRules.BaseAssaultFinalRoundsWindow` (default `5`) is removed and replaced with
`BaseAssaultUnlockRound` (default `8`). `BaseAssaultsUnlocked()` becomes:

```csharp
private bool BaseAssaultsUnlocked() => _state.CurrentRound >= _state.Rules.BaseAssaultUnlockRound;
```

`GameRules.Marathon` (`RoundLimit = 30`) is unaffected by this tunable and now also unlocks base
assaults at round 8, same as the default ruleset - the whole point of making this absolute rather
than relative.
- Alternative considered: keep both tunables, with `BaseAssaultUnlockRound` as a floor and the
  window as an additional constraint. Rejected - the user explicitly asked for a fixed round 8
  regardless of ruleset; keeping the window around unused would be dead configuration surface.

## Risks / Trade-offs

- **[Risk] An unbounded self-heal chain could, in principle, let a player spend an entire turn
  healing to full and still have "leftover" turn to attack - is that too strong?** → Accepted as the
  explicitly requested behavior (this proposal exists specifically to reverse the prior "no chain,
  it'd be too strong" decision). The ceiling is still tight in practice: at most 4 self-heal
  questions in a row (1→5 HP) before the self-heal option disappears and only an attack (or nothing,
  if isolated) remains.
- **[Risk] An unbounded enemy-base assault chain (already true in code, now merely documented) means
  a single unlucky defender can lose their base in one turn with no chance to respond in between.** →
  Accepted as existing, already-shipped behavior; this proposal does not change it, only its
  documentation. No new risk introduced.
- **[Trade-off] Removing `BaseAssaultFinalRoundsWindow` is a breaking rename for any external tooling
  or saved config referencing it.** → No persistence layer and no external config consumers exist in
  this repo (in-memory room state only, per `CLAUDE.md`), so this is safe.

## Migration Plan

No data migration (in-memory room state only). Deploy as a normal release. No feature flag - the
chain-length change is a documentation-only correction (code already behaves this way), and the
self-heal/round-gating changes are small, self-contained `Domain` edits with no DTO/projection
impact, matching how prior small rules changes in this repo have shipped directly.

## Open Questions

None outstanding. Scope, exact code locations, and the one true logic change (self-heal turn
retention) plus one tunable rename (round gating) are settled by the Decisions above. The Purpose
paragraph at the top of `openspec/specs/battle-flow/spec.md` ("up-to-three-question assaults") is
prose context rather than a versioned requirement; it gets corrected by hand alongside the code
changes during apply, not through the delta's `ADDED`/`MODIFIED` requirement blocks.
