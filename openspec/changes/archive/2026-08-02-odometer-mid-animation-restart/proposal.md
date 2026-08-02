## Why

`useAnimatedNumber` (backing the score `Odometer`) only updates its animation-origin ref
(`fromRef.current`) in two places: under reduced motion, or once an animation reaches `t >= 1`
naturally. If the target `value` changes again before the current ~320ms animation finishes -
plausible whenever several `scoreDelta` snapshots land in quick succession, such as during a battle
reveal cascade - the effect's cleanup cancels the in-flight animation frame but never syncs
`fromRef` to the number actually on screen. The next animation then restarts from that stale,
older origin instead of from wherever the display currently sits, so the player sees their score
visibly jump backward for an instant before snapping forward again - the opposite of the smooth
"rolls up" effect this component exists to provide.

## What Changes

- Track the currently-displayed value in a ref updated on every animation tick (not just at
  natural completion), and use that ref - not the old completion-only ref - as the origin whenever
  a new animation starts.
- No visible behavior change for the common case (an animation that runs to completion
  uninterrupted); this only fixes what happens when a new value arrives mid-animation.
- No change to game logic, rules, DTOs, or server/domain code - client-only animation-correctness
  fix.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `client-presentation`: strengthens the existing "score changes get visible feedback" ground by
  requiring that feedback never itself display a wrong intermediate value.

## Impact

- Affected code: `src/Triviador.Client/src/components/Odometer.tsx` only. No server, domain, or DTO
  changes, no new dependencies.
