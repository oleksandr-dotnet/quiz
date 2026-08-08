## Context

The server broadcasts only full `GameViewDto` snapshots (see `RoomActor`'s design notes) — there is
no event/delta channel to the client. `useGameTransitions(current, previous)` is already the
client's one mechanism for turning "what changed between two snapshots" into discrete, nameable
moments (`baseCaptured`, `playerEliminated`, `baseAssaultScoreAdjusted`, ...), consumed today by
`App.tsx`'s `proclamationQueue` effect. `PlayerRoster.streakTierClass` already encodes a tier ladder
in CSS-class form: bronze 1-3, silver 4-5, gold 6, rainbow 7+. This change adds one more transition
kind to the same diffing function and one more proclamation case, rather than inventing a parallel
mechanism.

## Goals / Non-Goals

**Goals:**
- Fire a room-wide, escalating callout exactly at the same tier boundaries the badge already uses,
  so the moment and the visual both agree ("this is when it started mattering more").
- Reuse existing infrastructure end to end: the diffing function, the proclamation queue/Toast, the
  mute-gated synth sound module. No new component, no new store slice.

**Non-Goals:**
- No per-card visual pulse/flash on `PlayerRoster` tied to the milestone (would need transitions
  piped into a component that doesn't currently receive them) — the toast + sound is the full
  scope of this change.
- No streak-loss callout (a streak resetting to 0 is not a moment worth interrupting play for).
- No player-specific muting of *other* players' streak callouts — same all-or-nothing mute as every
  other sound cue.

## Decisions

### 1. Milestone thresholds mirror the existing badge tiers exactly
Fire at `answerStreak` values `4` (entering silver), `6` (entering gold), `7` (entering rainbow),
and every `+3` after `7` (`10`, `13`, ...) so a very long streak keeps escalating rather than going
silent after the badge maxes out visually. Three message tiers are reused cyclically past the third
threshold (tier 3's message repeats for 10, 13, ...) rather than authoring unbounded copy for
streaks that are rare in practice.

### 2. Detected via the same before/after diff as every other transition
`useGameTransitions` already loops `current.players` against a `prevPlayers` map to detect
`scoreDelta`/`baseDamaged`. The same loop gains one more check:
`p.answerStreak > prevP.answerStreak && crossesThreshold(prevP.answerStreak, p.answerStreak)` — using
"crosses" (not "equals") so a single snapshot that jumps a player's streak by more than one (a
double-counted correct-answer batch, if that ever happens) still fires the highest threshold crossed
rather than none at all.

### 3. Shown to the whole room, not just the streaking player
Matches this change's stated goal (a *shared* moment, per the Dota reference) and needs no new
targeting logic — `proclamationQueue` already broadcasts identically to every client since each
client derives the same transitions from the same broadcast snapshot pair.

## Risks / Trade-offs

- **[Risk]** A player who reaches multiple milestones across turns in rapid succession could queue
  several proclamations back to back. → **Mitigation**: already handled by the existing
  `proclamationQueue` drain-one-at-a-time behavior; no new risk introduced.

## Migration Plan

Additive only, client-side, no persisted state. Ships as a single change.
