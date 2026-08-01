## Context

The game is functionally complete through Battle (M5, shipped 2026-08-01) but the client has never
had a design pass: it is substantially the unmodified Vite starter template (dark starter palette,
`<title>Vite + React + TS</title>`, a dead `prefers-color-scheme` fork, Inter declared but never
loaded), the map is a placeholder 6×3 grid of identical squares, the SVG map markup is copy-pasted
into three screens, the question panel is duplicated between `LandGrabScreen` and `BattleScreen`,
and several pieces of live state (`AnswerRoster`'s waiting state, reveal rank/speed, connection
status, room-closed reason) render nothing at all today. `GameViewDto`/`RoomActor.BuildGameView`
already project region-pick and attack-target eligibility (`PendingRegionPickViewDto`,
`EligibleRegionIds` via `_engine.EligibleRegionsFor`/`EligibleAttackTargetsFor`) but not base-pick
eligibility or battle context, even though `PendingActivity.RevealHold` already carries the
`QuestionPurpose` (`Duel`/`BaseAssault`) needed to build the latter.

## Goals / Non-Goals

**Goals:**
- A committed, cohesive parchment strategy-board visual identity across all six screens, built on a
  real component layer instead of six independent, partially-duplicated screens.
- Additive server projection so the client can highlight legal base picks and describe what a fight
  is actually about, without adding a new event/delta channel or changing any rule/timing.
- Motion-driven feedback for the moments today's UI renders silently or not at all (capture, base
  damage, elimination, connection loss), computed by diffing consecutive `GameView` snapshots.

**Non-Goals:**
- No game-rule, timing-window, or `GameRules`/`AnswerRanker` changes.
- No bot AI (M6). Bots still resolve by timeout — "waiting for opponent" must read as intentional for
  the full 10-20s, not broken.
- No dark mode, no router, no state-library swap, no Tailwind. Plain CSS with custom properties,
  matching the repo's existing hand-written idiom.
- No fix for land grab's missing `RevealHold` (see Risks below) — that needs an engine timing change
  and is out of scope for a presentation-only change.

## Decisions

**Snapshot diffing over a new event channel.** `IGameClient` has exactly three methods
(`State`/`GameState`/`RoomClosed`) and the 22 domain events in `GameEvents.cs` never leave the
server. Rather than adding a delta/event channel (a server behavior change with its own secrecy
surface to re-audit), the client stores `previousGameView` alongside `gameView` and a
`useGameTransitions` hook derives a transition queue from `(previous, current)`. This keeps the
server change purely additive-DTO and keeps the anti-cheat boundary (`StateProjector` is the only
code that reads engine state) exactly where it is today. Trade-off: one snapshot can encode several
transitions at once (a single `RevealHold` timeout can produce base damage + a base capture + an
elimination + a round advance together) - the queue plays them in a fixed order with stagger rather
than assuming one transition per snapshot.

**One `EligibleBaseRegions` query, reused by both the projector and the validator.** Base-pick
legality logic already exists (`IsTooCloseToExistingBase`, `AnyRegionSatisfiesBaseDistance`,
including the "waived when nothing qualifies" fallback used by timeout auto-pick) but only as
per-candidate checks, not as a query returning the full eligible set. Extracting a pure
`EligibleBaseRegions(GameState)` function gives the projector and the existing validator one source
of truth instead of two independently-maintained legality implementations - the same pattern already
used for `EligibleRegionsFor`/`EligibleAttackTargetsFor`.

**`BattleContextDto` reads `PendingActivity.Question.Purpose` / `RevealHold.Purpose` directly.**
`QuestionPurpose.Duel(Attacker, Defender, Region)` and `BaseAssault(Attacker, Defender, BaseRegion,
QuestionIndex, DamageDealtThisTurn)` already carry every field the client needs; they are simply never
projected today. No new domain state is needed, only a projection. The DTO exposes only facts both
combatants already know (identities, contested region, assault progress) - never an in-flight answer
or the correct answer, preserving the existing in-flight-secrecy guarantee.

**Hand-authored organic map via a committed, deterministic generator, topology unchanged.** A
7×4 lattice over a `0 0 1200 640` viewBox with seeded-PRNG-jittered interior vertices; each region is
its quad's four corners as cubic-Béziers; each lattice edge is computed once and shared by both
adjoining regions so there are no seams. The generator preserves the exact existing 18-region/6×3/
4-neighbour adjacency graph and 200/400 value split - `MapValidator`, `MinimumBaseDistance = 2`, and
land-grab reachability are unaffected because only geometry, names, and label positions change. The
generator is a build-time tool (`tools/mapgen/generate-map.mjs`); the committed `map.json` is the
runtime source of truth, so determinism/replayability are untouched.

**The map never unmounts across phase changes.** `AppShell` renders one persistent map slot that all
six screens share, rather than each screen mounting its own `<svg>`. This is what allows territory
identity (and `motion` animations on it) to survive base-selection → land-grab → battle without a
remount, and is the single structural precondition the Stage 4 motion set-pieces depend on.

**`motion` (framer-motion) + self-hosted `@fontsource-variable` fonts, no CDN.** Matches the
"no external host" constraint already implicit in the repo (single-folder `dotnet publish`, no
network dependency at runtime). Reduced-motion is handled once, at the CSS custom-property layer
(`--dur-*` zeroed under `prefers-reduced-motion: reduce`), so both CSS transitions and `motion`
animations honor it from the same source without every call site checking it separately.

## Risks / Trade-offs

- **[Risk] Land grab has no `RevealHold` (unlike Battle):** the question result arrives as a one-shot
  `lastReveal` on the same snapshot as the next pick prompt, and is lost on reconnect.
  → **Mitigation:** the client renders it as a non-blocking 3s overlay that never covers the pick
  affordance, so results and the next prompt coexist instead of racing. Documented here as a known,
  deliberate limitation rather than silently worked around; a real fix needs an engine timing change
  and is out of scope.
- **[Risk] `tests/e2e/specs/room-lobby.spec.ts` has zero `data-testid` usage today** and locates
  everything via CSS classes (`.seat-list`, `li.seat`, `.seat-name`), placeholders, and role/name
  queries, all of which this change's markup rewrite invalidates.
  → **Mitigation:** `data-testid` attributes are added in the same commits as the markup they label
  (not retrofitted after), and the spec/helpers are updated in the same change rather than left
  broken for a follow-up.
- **[Risk] One snapshot can encode multiple simultaneous transitions** (capture + damage +
  elimination + round advance in one broadcast), which could look chaotic if animated at once.
  → **Mitigation:** `useGameTransitions` emits a fixed-order, staggered queue rather than firing all
  detected transitions simultaneously.
- **[Trade-off] Additive-only DTO fields mean some duplication** (e.g. `CurrentPickerPlayerId`/
  `DeadlineUtc`/`YouAreCurrentPicker` stay on `GameViewDto` alongside the new
  `PendingBasePickViewDto`) for backward compatibility within the same change rather than a clean
  cutover. Accepted because this is a UI-only change; nothing else in the system reads these fields.

## Migration Plan

Additive-only server change: Stage 1 lands and is independently verifiable with the *old* UI still
working (it simply ignores the new DTO fields). Stages 2-4 are a client-only rebuild with no server
dependency beyond Stage 1's additions already being in place. No data migration; `map.json` is
regenerated wholesale from the committed generator, not migrated field-by-field. No rollback concern
beyond reverting the change, since no persisted state format changes (rooms are in-memory and
short-lived per `CLAUDE.md`'s architecture).

## Open Questions

None outstanding - decisions above resolve every point flagged during exploration (snapshot diffing
vs. new channel, query extraction approach, map generator method, testid migration timing).
