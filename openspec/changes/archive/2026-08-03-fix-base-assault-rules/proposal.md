## Why

Playtesting surfaced three mismatches between how base assaults are meant to feel and what the
current rules actually do:

- Base assaults are already documented (and coded) with an implicit "up to three questions per
  turn" framing that no longer reflects the code, which already lets a chain run past three
  questions in one turn (it's bounded only by the base's remaining hit points, not a fixed count) -
  the spec text was never updated after that behavior shipped. The desired behavior is explicit and
  unambiguous: an attacker keeps chaining hits against the same base for as long as they keep
  winning, stopping only on a draw or a defender win, with no fixed per-turn cap at all - a fresh
  5-HP base can fall in a single turn if the attacker wins every question.
- Self-healing your own base currently spends the turn on exactly one question no matter the
  outcome, even when you answer correctly. That makes healing strictly worse than it should be: a
  player who wants to shore up a badly damaged base has no way to bring it back to full strength
  without giving up several turns' worth of attacking, one heal per turn. The desired behavior lets
  a correct heal keep the turn (chain multiple heals, then still attack if there's turn left), only
  passing the turn on an incorrect or missed answer.
- The round at which base assaults (and self-heals) become available has never been written down
  as its own spec requirement - it only exists as a formula in code
  (`RoundLimit - BaseAssaultFinalRoundsWindow`) that happens to equal round 8 for the default
  ruleset but drifts for any other ruleset (e.g. a longer "Marathon" mode wouldn't unlock until
  round 26). The desired behavior is a fixed, ruleset-independent round 8.

## What Changes

- A base assault chain no longer has any fixed per-turn question cap. The attacker keeps answering
  against the same base as long as they keep winning; the chain ends only on a tie or a defender
  win, exactly as it already does today when a base has 5 or fewer hit points remaining - this
  proposal makes that the documented, permanent rule rather than an artifact of "however many hit
  points happen to be left."
- A correct self-heal answer keeps the turn with the same player instead of ending it. They may
  immediately heal again (if still damaged) or attack an enemy region, all in the same turn. An
  incorrect, inexact, or missed self-heal answer still ends the turn and passes it on, unchanged
  from today.
- Base assaults (including self-heal) unlock at a fixed round 8, regardless of `GameRules.RoundLimit`
  or which ruleset is active, replacing the current relative "last N rounds of the round limit"
  formula.

## Capabilities

### Modified Capabilities
- `battle-flow`: base-assault chains have no per-turn question cap (documentation now matches
  existing chain-until-stopped code); a correct self-heal keeps the turn instead of always ending
  it; a new requirement documents the fixed round-8 unlock threshold for base assaults and
  self-heal, independent of the ruleset's round limit.

## Impact

- `src/Triviador.Domain/Engine/GameEngine.Battle.cs` - `ResolveRevealHold`'s self-heal branch
  (`QuestionPurpose.BaseAssault` where `Attacker == Defender`) needs to keep the turn on a correct
  heal instead of unconditionally calling `AdvanceTurn`; `BaseAssaultsUnlocked()` needs to compare
  against a fixed round instead of `RoundLimit - BaseAssaultFinalRoundsWindow`. The existing
  attacker-vs-defender assault branch (lines 247-288) needs no logic change - it already has no
  fixed cap - but its surrounding comment should stop describing a "5-question cap" as incidental
  and just say there is no cap.
- `src/Triviador.Domain/State/GameRules.cs` - replace `BaseAssaultFinalRoundsWindow` with a new
  `BaseAssaultUnlockRound` (default `8`) tunable.
- `openspec/specs/battle-flow/spec.md` - reword the base-assault-chain and self-heal requirements to
  drop the stale "up to three questions" / "always ends the turn" language, and add a new
  requirement documenting the fixed round-8 unlock threshold (this threshold was never previously
  written down as a spec requirement, only implemented in code).
- No DTO, projection, or client changes - `BaseHitPoints`, the `BattleContextDto` shape, and the
  existing map/roster HP display already handle any HP value and any number of chained questions
  correctly with no assumptions about a fixed cap.
