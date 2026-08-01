## 1. Server projection + new map

- [x] 1.1 Add `Name`, `LabelX`, `LabelY` to `Triviador.Domain/Map/RegionDescriptor.cs`
- [x] 1.2 Extend `MapRepository`'s `RegionJson` to parse the new fields; fail startup on a missing name
- [x] 1.3 Write `tools/mapgen/generate-map.mjs` (plain Node, no deps): 7x4 lattice, seeded jitter, shared-edge quads, ragged outer coastline, 18 hand-written territory names, centroid label anchors
- [x] 1.4 Run the generator to regenerate `src/UI/Triviador.Web/Data/map.json`; confirm adjacency graph and 200/400 value split are byte-for-byte unchanged from the placeholder map
- [x] 1.5 Add a pure `EligibleBaseRegions()` query to `Triviador.Domain/Engine/GameEngine.BaseSelection.cs`, extracted from the existing `IsTooCloseToExistingBase`/`AnyRegionSatisfiesBaseDistance` logic including the distance-waiver fallback. Implemented as a public instance method (matching the existing `EligibleRegionsFor`/`EligibleAttackTargetsFor` sibling methods' convention) rather than a static `GameState` overload, reading `_state`/`_adjacency` the same way they do.
- [x] 1.6 Add `PendingBasePickViewDto`, `BattleKindDto`, `BattleContextDto` to `Triviador.Application/Contracts/GameViewDto.cs`; extend `RegionViewDto` with `Name`/`LabelX`/`LabelY`/`AdjacentTo` and `PlayerViewDto` with `IsConnected`
- [x] 1.7 Wire `PendingBasePick` and `Battle` projection into `RoomActor.BuildGameView`, reading `PendingActivity.Question.Purpose`/`RevealHold.Purpose` and the connection map; confirm no in-flight answer or correct answer is exposed
- [x] 1.8 Hand-sync `src/Triviador.Client/src/api/contracts.ts` with every new/changed field
- [x] 1.9 Verify: `dotnet build` green; `node tools/mapgen/generate-map.mjs` produces an empty diff on a clean tree; existing UI still runs unmodified against the new server (ignores new fields)

## 2. Design foundation and shell

- [x] 2.1 Add `motion`, `@fontsource-variable/fraunces`, `@fontsource-variable/inter` to `src/Triviador.Client/package.json`
- [x] 2.2 Create `theme/tokens.css` (paper/ink/gilt/seat custom properties, radii, shadows, durations, `prefers-reduced-motion` zeroing)
- [x] 2.3 Create `theme/paper.css` (full-viewport grain background, `.paper-card` utility); delete the starter's `body{display:flex}`, the dead `prefers-color-scheme` fork, and Vite button styles from `index.css`
- [x] 2.4 Create `theme/typography.css` (Fraunces display / Inter body, self-hosted, tabular-nums on numeric fields)
- [x] 2.5 Create `lib/seats.ts`: move `SEAT_COLORS`/`colorForPlayer` out of `BaseSelectionScreen.tsx`; update the three importing screens (`BattleScreen`, `LandGrabScreen`, `ResultsScreen`); add four heraldic hatch-pattern SVG defs
- [x] 2.6 Build `components/AppShell.tsx` (topBar/map/dock/roster slots); update `App.tsx` so its phase `switch` returns slot content wrapped in `AnimatePresence`; confirm the map slot never unmounts across a phase change
- [x] 2.7 Verify: `npx tsc -b --noEmit` green; shell renders across all phases with no console errors. Confirmed via Playwright through Landing/Lobby/BaseSelection/LandGrab so far (Battle/Results verified under group 3.8).

## 3. Map component, shared components, screen rebuild

- [x] 3.1 Build `components/map/{GameMap,RegionShape,WaxSeal,ValueBadge,HeraldicDefs}.tsx` replacing the three copy-pasted `<svg>` map blocks, per the layered-`<g>` prop contract in design.md
- [x] 3.2 Build shared components: `QuestionCard`, `Timer`, `AnswerRoster`, `RevealOverlay`, `PlayerRoster`, `Odometer`, `ConnectionBadge`, `Toast`
- [x] 3.3 Rebuild `LandingScreen`, `LobbyScreen` on the shared components/shell; add room-code/deep-link affordances per the reference doc
- [x] 3.4 Rebuild `BaseSelectionScreen` using `pendingBasePick.eligibleRegionIds` for highlight + ineligible tooltip
- [x] 3.5 Rebuild `LandGrabScreen`: non-blocking 3s reveal overlay, gilt marching-ants on eligible picks, timing driven off the server deadline (fixing the `REVEAL_FADE_MS` vs. `RevealHoldDurationSeconds` mismatch)
- [x] 3.6 Rebuild `BattleScreen` using `BattleContextDto` for the dock line and contested-territory marker; attack-target highlight from `eligibleTargetRegionIds`
- [x] 3.7 Rebuild `ResultsScreen` (winner banner, settled map, standings, play again - implemented as "return to start" since no server-side rematch/restart command exists; inventing one was out of scope for a presentation-only change)
- [x] 3.8 Verify: `npx tsc -b --noEmit` green; manual click-through via Playwright against the dev servers covered Landing, Lobby, BaseSelection, LandGrab, and Battle directly (see 5.4) - Results was not personally observed live (see 5.4's caveat) but its Dock reuses the already-verified `PlayerRoster` and is otherwise straightforward, type-checked JSX

## 4. Motion set-pieces

- [x] 4.1 Add `previousGameView` tracking to `store/gameStore.ts`'s `applyGameView`
- [x] 4.2 Build `hooks/useGameTransitions.ts` deriving an ordered, staggered transition queue from `(previous, current)`
- [x] 4.3 Wire the 9 set-pieces reading Stage 2's duration tokens: base placed (wax seal spring-mounts), territory claimed/captured (owner-fill layer remounts keyed by owner, replaying a claim-wash), base assault hit (HP pip color transition + brief map shake driven by `useGameTransitions`' `baseDamaged`), base captured (wax seal shatters via `AnimatePresence` exit + a "banner falls" proclamation toast driven by `baseCaptured`), elimination (player-card grayscale/opacity transition + fading-in fallen banner), round advance (round numeral flip in the top bar), timer critical (existing pulse from Stage 3), victory (gilt shimmer on the results headline)
- [x] 4.4 Verify: watched base placement, territory claim, duel reveal/tie-resolution, and round-advance fire live via a bot-timeout-driven "Play vs 3 bots" run through Playwright; base-assault-hit/base-captured/elimination/victory were not personally witnessed firing live in this run (the round-trip-vs-countdown timing noted in design.md made forcing a specific capture unreliable) but are implemented and type-check cleanly - flagged as a follow-up manual check rather than claimed as directly observed

## 5. Test surface and final verification

- [x] 5.1 Add `data-testid` attributes across the rebuilt markup (`seat-{n}`, `start-game`, `room-code`, `region-{id}`, `option-{n}`, `tip-input`, `timer`, `player-card-{seat}`) in the same commits as the markup they label
- [x] 5.2 Update `tests/e2e/specs/room-lobby.spec.ts` and `helpers.ts` to use the new `data-testid` selectors instead of today's class/placeholder/role-text queries
- [x] 5.3 Run full verification: `dotnet build`; `npx tsc -b --noEmit`; `node tools/mapgen/generate-map.mjs` (empty diff, confirmed idempotent by hash); `npx playwright test` (13/13 pass); `dotnet publish -c Release` + smoke run (required clearing a stale `obj`/`bin` StaticWebAssets manifest unrelated to this change, then passed clean)
- [x] 5.4 Manual pass via Playwright against the dev servers: landing -> lobby -> base selection (wax-seal mount, eligible highlight) -> land grab (choice + tip questions, reveal overlay, claim-wash) -> battle (duel headline, base-assault headline, contested marker, attack-target highlight, round-flip) -> reduced-motion (duration tokens zero out, no layout breakage) -> 380px narrow layout. Two real bugs found and fixed during this pass: bots incorrectly showed a "disconnected" glyph (`RoomActor.BuildGameView`'s `IsConnected` now treats bots as always connected), and a CSS grid `1fr`/stretch interaction left a blank gap between content and the dock on both the 380px and desktop layouts (`.app-shell` rows changed to content-sized, `.shell-map` given `align-self: start`). Results screen and the base-assault-hit/base-captured/elimination/victory set-pieces were not personally witnessed live (bots have no AI yet - M6 - so duels only resolve when the human actually answers in time, and round-trip latency versus the 10-20s countdowns made this unreliable to force repeatedly) - implemented and type-checked, flagged as a follow-up manual check rather than claimed as directly observed
- [x] 5.5 Run `/opsx:archive` for this change (no `opsx:verify` skill exists in this repo; `openspec validate --strict` already confirmed the change is structurally valid, and 5.3/5.4 cover functional verification)
