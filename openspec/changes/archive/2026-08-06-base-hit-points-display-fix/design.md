## Context

`GameRules.BaseHitPointsDefault` moved from 3 to 5 in `e62ac87` ("Rebalance territory costs, capital
HP/timing, and duel ties"). That commit touched `WaxSeal.tsx` (the on-map base marker) to draw 5 pips
but left three other client-side mentions of the old value untouched: `PlayerRoster.tsx`'s roster pip
count, and the `battle.headlineAssault*`/`howToPlay.battle.body` translation strings in both locales.
There is no automated check for this kind of drift - `CLAUDE.md` already documents `contracts.ts` as
hand-mirrored for the same reason - so nothing caught it until a live playthrough actually showed a
base assault chain outrunning its own headline's stated cap ("hit 4 of 3").

## Goals / Non-Goals

- Goal: one source of truth on the client for `GameRules.BaseHitPointsDefault`, so `WaxSeal` (already
  correct) and every other display of the same number can't drift independently again.
- Goal: fix the roster pips, the assault headline's stated max, and the 0-based `hitIndex` off-by-one
  in the same headline, since all three are the same "assault progress display" surface and a player
  would reasonably expect them to already agree with each other.
- Non-goal: change `GameRules.BaseHitPointsDefault` itself, or any Domain/Application logic -
  `assaultQuestionIndex`'s 0-based numbering is a fine internal representation; only the client's
  display of it needed to shift by one.
- Non-goal: chase the Finished-screen scroll-shadow observation noted in proposal.md's "Known issue" -
  not confirmed as a real gap (plausible false negative from an early screenshot), and confirming it
  needs another full playthrough.

## Decision

Add `src/Triviador.Client/src/lib/gameRules.ts` exporting `BASE_HIT_POINTS_DEFAULT`, following the
exact pattern `lib/timers.ts` already established for mirroring `GameRules`' duration defaults (a
small, hand-kept-in-sync client constant with a comment naming its C# source). `WaxSeal.tsx` imports
it (aliased to its existing local name `MAX_BASE_HIT_POINTS` to keep that file's diff minimal);
`PlayerRoster.tsx` and `BattleScreen.tsx` import it directly.

The three `battle.headlineAssault*` translation keys gain a `{{maxHitPoints}}` placeholder instead of
a literal number, with `BattleScreen.tsx` supplying `BASE_HIT_POINTS_DEFAULT` as that param - keeping
the number in exactly one place rather than also hardcoding "5" into the translation strings (which
would just be the same class of bug waiting to happen again on the next balance change).

`howToPlay.battle.body` is left as a plain hardcoded "five" rather than wired through an interpolation
param: it's a static prose sentence in a modal with no other numeric interpolation, and
`HowToPlayModal.tsx` renders all four phase sections through one generic `t(key)` loop - threading a
`maxHitPoints` param through every call for the sake of one string was judged not worth the added
indirection for a value that changes this rarely. This one string still needs a manual update if
`BaseHitPointsDefault` changes again, same as it needed one this time; every other display of the
number no longer does.

`hitIndex` becomes `(battle.assaultQuestionIndex ?? 0) + 1` (previously `?? 1` applied to the raw,
0-based value) - a one-line fix once the 0-based numbering was traced back to
`QuestionPurpose.BaseAssault(..., QuestionIndex: 0, ...)` in `GameEngine.Battle.cs`, confirmed by the
live "hit 0 of 3" / "hit 4 of 3" log lines from the same playthrough that found the stale-3 bug.

Alternatives considered:
- **Derive the roster pip count from `player.baseHitPoints` itself (e.g. render exactly as many pips
  as current HP, no fixed max).** Rejected: the pips' whole purpose is showing *remaining out of max*
  at a glance (matching `WaxSeal`'s same rendering, which needs the true max to know how many hollow
  pips to draw) - a variable-length list can't show "3 of 5" as distinct from "3 of 3".
- **Have the server project the max directly on `GameViewDto` instead of a hand-mirrored client
  constant.** More robust long-term, but a bigger change (new DTO field, `StateProjector` plumbing)
  for a value that changes only on rare balance passes - out of scope for this small display fix,
  consistent with this repo's existing hand-mirrored-constants convention (`lib/timers.ts`,
  `contracts.ts`).
