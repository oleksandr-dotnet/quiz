## Why

`PlayerViewDto.AnswerStreak` already exists and `PlayerRoster` already tiers its badge
(bronze/silver/gold/rainbow), but nothing calls a streak out in the moment it happens — a player
climbing to a 6- or 7-streak gets a slightly different badge color and nothing else. Dota's
killstreak announcer ("Killing Spree", "Godlike") is the reference point: the payoff of a hot streak
is a loud, shared, escalating moment everyone at the table notices, not a passive color change. This
adds that moment using data the client already has, with no engine or DTO changes.

## What Changes

- `useGameTransitions` gains a new derived transition, `streakMilestone`, computed the same way
  every other transition there already is (diffing `current`/`previous` snapshots) — fired when a
  player's `answerStreak` crosses one of a fixed set of thresholds that line up with
  `PlayerRoster`'s existing tier boundaries (entering silver, entering gold, entering rainbow, and
  every third streak after that).
- `App.tsx`'s existing `proclamationQueue` (already used for base-falls/elimination/bonus messages)
  gets a new case: a streak milestone enqueues a localized, escalating message
  ("`{name}` is on fire!" → "`{name}` is unstoppable!" → "`{name}` is godlike!" → repeats for
  streaks beyond that), shown to every player in the room, not just the one on the streak.
- `lib/sound.ts` gains `playStreakMilestone(tier)`, a short synthesized cue that gets more elaborate
  at higher tiers (mirroring how `playGolden` is already deliberately more elaborate than
  `playCorrect`), gated by the existing mute toggle.
- New i18n keys in `en.json`/`ru.json` for the three tiered messages.

## Capabilities

### New Capabilities
- `streak-callouts`: a player's answer streak crossing a milestone threshold produces a room-wide,
  tiered proclamation and sound cue, escalating in tone as the streak climbs.

## Impact

- **Affected code**: `src/Triviador.Client/src/hooks/useGameTransitions.ts` (new transition kind),
  `src/Triviador.Client/src/App.tsx` (new proclamation case), `src/Triviador.Client/src/lib/sound.ts`
  (new cue), `en.json`/`ru.json` (new keys).
- **No changes** to any DTO, `Triviador.Domain`, `Triviador.Application`, or `Triviador.Infrastructure`
  — `AnswerStreak` is already on the wire.
