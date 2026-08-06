## 1. Single source of truth for the base HP maximum

- [x] 1.1 Add `src/Triviador.Client/src/lib/gameRules.ts` exporting `BASE_HIT_POINTS_DEFAULT = 5 //
      GameRules.BaseHitPointsDefault`.
- [x] 1.2 `WaxSeal.tsx`: replace the local `MAX_BASE_HIT_POINTS = 5` constant with an import of
      `BASE_HIT_POINTS_DEFAULT` (aliased to the same local name).

## 2. Fix the stale-3 displays

- [x] 2.1 `PlayerRoster.tsx`: render `BASE_HIT_POINTS_DEFAULT` pips instead of a hardcoded 3.
- [x] 2.2 `BattleScreen.tsx`: pass `maxHitPoints: BASE_HIT_POINTS_DEFAULT` to the three
      `battle.headlineAssault*` translation calls; fix `hitIndex` to `(battle.assaultQuestionIndex ??
      0) + 1` so the first question in a chain reads "hit 1 of 5", not "hit 0 of 3".
- [x] 2.3 `en.json`/`ru.json`: `battle.headlineAssaultSelfAttack`/`SelfDefend`/`Others` interpolate
      `{{maxHitPoints}}` instead of a literal "3"; `howToPlay.battle.body` says "five"/"пяти" instead
      of "three"/"трёх".

## 3. Verification

- [x] 3.1 `cd src/Triviador.Client && npx tsc -b --noEmit` passes.
- [x] 3.2 `dotnet build` passes.
- [x] 3.3 `npm test` in `tests/e2e`: 16/16 passing (one `kick-player` test failed on an initial run;
      re-ran in isolation and via `git stash` A/B against the pre-change baseline - failed
      inconsistently on both, confirming a pre-existing flake unrelated to this change).
- [x] 3.4 Live Playwright re-check on all three target devices (iPhone 16, iPhone 17, OnePlus 13R):
      after picking a base, the roster's hit-point pips measure 5 pips / 29px wide (`5*5px + 4*1px
      gap`, matching the mobile `.hp-pip`/`.hit-points` CSS), comfortably inside each ~85-92px-wide
      compact roster card with no overflow, and `document.scrollingElement.scrollHeight <=
      clientHeight` held on all three (no scroll introduced).
- [x] 3.5 Root-caused via `git log -S"BaseHitPointsDefault = 5"` and confirmed live during a full
      playthrough that reached base assault on all three devices: the log captured the exact
      "hit 0 of 3" / "hit 4 of 3" sequence this change fixes.
