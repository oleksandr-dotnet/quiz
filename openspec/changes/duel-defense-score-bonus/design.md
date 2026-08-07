## Context

See proposal.md - Why. Grounded in the current code:

- `ApplyDuelOutcome` (`GameEngine.Battle.cs`) already computes exactly the condition that decides
  whether the region changes hands: `!Withdrawn(attacker) && !BothAnsweredIncorrectly && AttackerWon`.
  When that condition is false - attacker withdrawn, both answered incorrectly (tie), or the defender
  simply ranked better - the region stays with the defender. That's precisely "the defender
  successfully defended," the same set of cases the sibling `ApplyBaseAssaultOutcome` already treats
  as a defender win for its own (symmetric) bonus.
- `ApplyBaseAssaultOutcome` is the existing, working precedent for this exact kind of score
  adjustment: it reads `_state.Rules.BaseAssaultScoreBonus`, mutates `PlayerById(...).BonusScore`,
  and emits a dedicated event (`BaseAssaultScoreAdjusted`). This change reuses that plumbing
  (`PlayerState.BonusScore`, its inclusion in `GameState.ScoreOf` and `Fingerprint()`) as-is - nothing
  about how the bonus is stored or scored changes, only when it's awarded and how it's reported.
- The client already has a working view-diff pattern for turning a resolved base-assault question
  into a proclamation (`useGameTransitions`'s `baseAssaultScoreAdjusted` derivation, keyed off
  `previous.battle?.kind === 'BaseAssault'` and the reveal just closing). The duel case follows the
  same idiom keyed off `previous.battle?.kind === 'Duel'` instead.

## Goals / Non-Goals

**Goals:**
- A duel that resolves with the defender keeping the region (better rank, or a tie/double-wrong,
  or a withdrawn attacker) adds `GameRules.BaseAssaultScoreBonus` to the defender's `BonusScore`.
- The attacker's score is never reduced by this bonus, and no bonus is paid when the attacker
  captures the region.
- The bonus is visible in `PlayerView.score` immediately and surfaced as a client proclamation,
  mirroring the existing base-assault bonus UX.

**Non-Goals:**
- No new `GameRules` tunable - the duel-defense bonus reuses `GameRules.BaseAssaultScoreBonus`
  (same 200-point value) rather than introducing a second, independently configurable amount. See
  the Decisions section for why a rename/split was considered and rejected.
- No change to base-assault behavior, self-heal, or land grab - only `ApplyDuelOutcome`'s
  non-capture branch gains new behavior.
- No change to which side wins a duel, or to `AnswerRanker`/tie-break rules - this change only adds
  a score side-effect to an outcome that's already fully decided.

## Decisions

### Reuse `GameRules.BaseAssaultScoreBonus` rather than adding a second tunable

The user-specified amount is the same 200 points already used for base defense, and there's no
stated need to tune duel defense independently of base defense. A generically-named field
(`BaseAssaultScoreBonus`) now backing two related-but-distinct mechanics is a minor naming
imprecision, not a design problem - `GameRules` fields are read in exactly one place each
(`ApplyBaseAssaultOutcome`, and now `ApplyDuelOutcome`), so nothing about the value's meaning is
ambiguous at the read site. Renaming it (e.g. to `DefenseScoreBonus`) was considered and rejected:
it would touch the field's declaration, every existing reference (domain, `RoomActor`, the TS
mirror `lib/gameRules.ts`, i18n interpolation keys, the archived change's own historical doc
comments), and the `battle-flow` spec's base-assault requirement - all pure renames with zero
behavior change, which is more blast radius than this change's actual goal justifies. If a future
change needs the two amounts to diverge, splitting the field then (with the rename) is
straightforward and localized to that change.

### A new, one-sided `DuelDefenseScoreAwarded` event, not a reuse of `BaseAssaultScoreAdjusted`

`BaseAssaultScoreAdjusted`'s doc comment explicitly says "never for an ordinary duel," and its shape
is a symmetric pair (`AttackerDelta`/`DefenderDelta`, always opposite and equal) that doesn't fit a
one-sided award. Rather than stretch that event's meaning or force a `0` attacker delta through it,
a new event models the one-sided case directly:

```csharp
public sealed record DuelDefenseScoreAwarded(PlayerId DefenderId, PlayerId AttackerId, RegionId RegionId, int Amount) : IGameEvent;
```

`RegionId` is included (unlike `BaseAssaultScoreAdjusted`, which has no region - a base assault's
region is implicitly the defender's base) because an ordinary duel's contested region is meaningful
context and already carried by the sibling `RegionCaptured` event for the opposite outcome.

### The bonus mutation lives in `ApplyDuelOutcome`'s existing `else` branch

```csharp
private ImmutableArray<IGameEvent> ApplyDuelOutcome(QuestionPurpose.Duel duel, QuestionResult result, Instant at)
{
    var events = ImmutableArray.CreateBuilder<IGameEvent>();

    if (!PlayerById(duel.Attacker).Withdrawn
        && !BothAnsweredIncorrectly(result, duel.Attacker, duel.Defender)
        && AttackerWon(result, duel.Attacker, duel.Defender))
    {
        _state.RegionOf(duel.Region).OwnerId = duel.Attacker;
        events.Add(new RegionCaptured(duel.Attacker, duel.Defender, duel.Region));
    }
    else
    {
        var bonus = _state.Rules.BaseAssaultScoreBonus;
        PlayerById(duel.Defender).BonusScore += bonus;
        events.Add(new DuelDefenseScoreAwarded(duel.Defender, duel.Attacker, duel.Region, bonus));
    }

    var ended = CheckEndConditions();
    events.AddRange(ended ?? AdvanceTurn(at));
    return events.ToImmutable();
}
```

The existing `if` condition already *is* "attacker captures the region" - its negation is exactly
"defender successfully defended," covering a withdrawn attacker, a double-wrong tie, and a
better-ranked defender uniformly, the same three cases `ApplyBaseAssaultOutcome` already folds into
its own defender-win branch. No new condition is introduced; the bonus rides the branch that's
already there.

- Alternative considered: only pay the bonus when the defender *outright* wins (excludes the
  double-wrong-tie and withdrawn-attacker cases). Rejected for consistency with
  `ApplyBaseAssaultOutcome`, which already treats a tie/withdrawal as a defender win for its own
  bonus - a duel-specific carve-out here would make the two score-bonus mechanics behave
  inconsistently for the same underlying "did the defender lose their territory or not" question.

### Client derivation mirrors `baseAssaultScoreAdjusted`, scoped to `Duel`

`useGameTransitions` gains a second branch alongside the existing `BaseAssault` one, keyed off
`previous.battle?.kind === 'Duel'` instead, using the same `revealJustClosed` signal. Because a duel
bonus is one-sided, the derived transition only needs a defender id (no winner/loser pair to infer):

```ts
| { kind: 'duelDefenseScoreAwarded'; defenderPlayerId: string; attackerPlayerId: string }
```

Whether the defender actually kept the region (rather than the attacker capturing it) is read off
whether a `regionCaptured` transition fired for that region in the same batch - if it did, the
attacker won and no bonus transition is pushed; otherwise the defender defended successfully. This
mirrors exactly how the existing `BaseAssault` branch infers its winner from `baseDamaged`/
`baseCaptured` transitions computed earlier in the same diffing pass. `App.tsx` gets one new
proclamation branch (`app.duelDefenseBonusProclamation`, shown only to the defending player - there
is no losing-side proclamation since the attacker's score never changes), and `RoomActor` logs
`DuelDefenseScoreAwarded` alongside `BaseAssaultScoreAdjusted` in `LogNotableEvents`.

## Risks / Trade-offs

- **[Risk] Reusing `BaseAssaultScoreBonus` for a non-base mechanic could read as a naming bug to a
  future reader.** -> Mitigated by the doc comment on both the field and the new event explaining the
  shared value is intentional, plus the `battle-flow` spec cross-referencing both requirements
  explicitly.
- **[Risk] The client's region-captured lookup to distinguish "defender won" from "attacker won" adds
  an implicit ordering dependency on `regionCaptured` transitions being computed first in the same
  pass.** -> Already true today for the existing `BaseAssault` branch (it depends on `baseDamaged`/
  `baseCaptured` being computed earlier in the same function) - this change follows the same,
  already-relied-upon ordering within `useGameTransitions`.

## Migration Plan

No data migration (in-memory room state only). No new persisted field - `BonusScore` already exists
and already defaults to `0`. Deploy as a normal release, same as the base-assault bonus itself.

## Open Questions

None outstanding.
