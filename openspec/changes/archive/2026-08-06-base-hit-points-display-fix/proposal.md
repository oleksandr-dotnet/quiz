## Why

This iteration's target was the two flows no prior mobile-UX pass had reached: base assault (gated
behind `GameRules.BaseAssaultUnlockRound`, round 8) and the Finished/game-over screen, both requiring
a full playthrough rather than a quick spot-check. A scripted, real-UI playthrough (one human tab per
target device, `play-vs-bots`, answering every question through the actual client - no
`page.evaluate` store/DOM hacks) reached both screens on all three target devices (iPhone 16, iPhone
17, OnePlus 13R) in ~14.5-16 minutes each, confirming the flows themselves lay out without scroll or
overflow.

That playthrough also surfaced a real, confirmed bug: the roster's base hit-point pips and the Battle
headline's assault-progress text both hardcode a stale maximum of **3**, while
`GameRules.BaseHitPointsDefault` has been **5** since `e62ac87` ("Rebalance territory costs, capital
HP/timing, and duel ties") - that commit updated `WaxSeal.tsx`'s on-map hit-point marker (which
already correctly draws 5 pips, `MAX_BASE_HIT_POINTS = 5 // matches GameRules.BaseHitPointsDefault`)
but missed three other places that still say 3:

- `PlayerRoster.tsx`'s roster hit-point pips: `Array.from({ length: 3 }, ...)` always renders exactly
  3 pips and marks a pip filled whenever `i < player.baseHitPoints` - so a base at 4 or 5 HP shows as
  fully filled (all 3 dots lit), visually indistinguishable from a base actually at 3 HP. Confirmed
  live: the roster showed "●●●" (3 dots, always filled) throughout an entire game where `WaxSeal` on
  the map correctly showed up to 5 pips for the same base.
- `battle.headlineAssaultSelfAttack`/`SelfDefend`/`Others` (`en.json`/`ru.json`): "hit {{hitIndex}} of
  **3**". Confirmed live via the playthrough log: a full-health base assault chain reached "hit 4 of
  3" (`assaultQuestionIndex` is 0-based server-side, so a 5-hit-point base takes indices 0-4 to
  fully capture) before the headline's own stated cap.
- `howToPlay.battle.body` (both locales): "chip away at an enemy base's hit points across up to
  **three** questions" - same stale number in the How To Play modal.

Separately, `BattleScreen.tsx`'s `hitIndex` used the server's 0-based `assaultQuestionIndex` directly,
so the very first question of every assault chain displayed as "hit 0 of ..." instead of "hit 1 of
...", an off-by-one independent of the stale-3 bug but visible in the same headline text.

This is a correctness bug, not mobile-only (both the roster and the headline render identically on
desktop), but it was found by, and is squarely in scope of, tonight's audit of the exact screens where
it's visible, and it's a small, well-scoped, client-only fix matching this repo's commit style.

## What Changes

- New `src/Triviador.Client/src/lib/gameRules.ts` exports `BASE_HIT_POINTS_DEFAULT = 5` (mirrors
  `GameRules.BaseHitPointsDefault`, same hand-kept-in-sync pattern `lib/timers.ts` already uses for
  duration defaults) as the one client-side source of truth for this number.
- `WaxSeal.tsx`'s previously-local `MAX_BASE_HIT_POINTS = 5` now imports that constant instead of
  duplicating it.
- `PlayerRoster.tsx` renders `BASE_HIT_POINTS_DEFAULT` pips instead of a hardcoded 3.
- `BattleScreen.tsx` passes `maxHitPoints: BASE_HIT_POINTS_DEFAULT` into the three assault-headline
  translation keys (replacing their hardcoded "of 3"), and computes `hitIndex` as
  `(battle.assaultQuestionIndex ?? 0) + 1` so the first question of a chain reads "hit 1 of 5" instead
  of "hit 0 of 3".
- `en.json`/`ru.json`: the three `battle.headlineAssault*` strings interpolate `{{maxHitPoints}}`
  instead of a literal "3"; `howToPlay.battle.body` in both locales now says "five" instead of
  "three".

## Impact

- `src/Triviador.Client/src/lib/gameRules.ts` (new)
- `src/Triviador.Client/src/components/map/WaxSeal.tsx`
- `src/Triviador.Client/src/components/PlayerRoster.tsx`
- `src/Triviador.Client/src/screens/BattleScreen.tsx`
- `src/Triviador.Client/src/i18n/resources/en.json`, `ru.json`

## Verified base-assault / Finished audit (no separate fix needed there)

Live measurement on all three target devices, reaching both target screens through a real
playthrough:

- Base assault target-selection/duel/reveal states: no scroll, no undersized tap target, base wax
  seal legible (already fixed by a prior iteration).
- Finished screen: `document.scrollingElement.scrollHeight <= clientHeight` held (no document scroll)
  on all three devices at the moment each was captured.

## Known issue found but not fixed here

The Finished screen's standings list (`ResultsDock`'s own `PlayerRoster`, sorted by score) appeared
cut off at the bottom edge on iPhone 16 and iPhone 17 screenshots - the "Copy result"/"Return to
start" buttons were outside the captured frame, with no `dock-scroll-shadow-bottom` fade visible at
that moment. `.shell-dock`'s existing `overflow-y: auto` + fade-cue mechanism (added by
`dock-scroll-shadow-affordance`) should make this content reachable and show a cue, exactly as it
already does for a long Tip-question reveal - but the screenshot was taken immediately on detecting
`results-dock` in the DOM, likely before `AppShell`'s ~1s settle-poll and the `Finished` dock's own
0.42s entrance transition finish, which is a plausible source of a false negative rather than proof
of a real gap. Confirming (or fixing) this needs a live check that waits for the dock to settle before
measuring `scrollHeight`/`scrollTop` and the shadow's computed opacity, which needs another full
playthrough to reach - left for a future iteration rather than guessed at here.
