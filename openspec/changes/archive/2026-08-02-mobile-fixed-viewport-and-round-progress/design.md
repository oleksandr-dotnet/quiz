## Context

Today the game screen (`AppShell`: top bar, map, player roster, phase dock) can grow taller than
the viewport and the page scrolls — `.app-shell`'s mobile rows are all `auto`-sized with no height
cap. The map additionally supports hand-rolled pinch-zoom/drag-pan (`MapViewport.tsx`) and a
landscape-orientation nudge (`RotateDeviceGate.tsx`), both added (`2026-08-02-mobile-optimization`)
when the map had small, real-world-shaped regions close to the 44px touch-target floor. A later
change, `abstract-map-rework`, replaced those regions with large, generic abstract shapes in a
fixed `viewBox` — the original small-touch-target justification for zoom/pan no longer holds.
Separately, the Battle-phase round display shows only the current round number; `GameRules
.RoundLimit` (the fixed round cap, default 12) already exists server-side but never reaches the
client.

## Goals / Non-Goals

**Goals:**
- Guarantee the game screen never scrolls, in any direction, on any phase (`BaseSelection`,
  `LandGrab`, `Battle`, `Finished`), on narrow viewports.
- Remove the now-unjustified pinch-zoom/pan and landscape-nudge behavior, resolving the direct
  conflict with the currently-active `mobile-viewport-interaction` spec.
- Surface rounds-remaining (not just current round) during Battle.

**Non-Goals:**
- Changing desktop's scrolling `.app-shell` behavior (`min-height: 100vh`, unconstrained rows) —
  out of scope; only the `@media (max-width: 900px)` mobile rules change, plus the two globally
  deleted components.
- `LandingScreen`/`LobbyScreen` — separate, small-content routes outside `AppShell`, not part of
  the hard no-scroll guarantee.
- Reducing question/option text length or adding responsive font-size clamping for outlier-long
  content — flagged as a fast-follow risk, not solved in this change.

## Decisions

### The map row is `minmax(0, 1fr)`; everything else sizes to content
The standard "chat app" layout pattern (header `auto`, message list `1fr`, composer `auto`)
structurally guarantees no overflow: a `minmax(0, 1fr)` grid track can shrink to 0 if its siblings
(top bar, roster, dock) need more room, so the shell's total height is bounded by its container
(`100dvh`) no matter how much content the dock or roster carry. This is why the map is the
*sacrificial* row and not, say, the dock: the map is the one piece of UI that degrades gracefully
when compressed (it's a fixed-viewBox SVG that letterboxes), whereas dock content (question text,
answer options) cannot be shrunk below legibility or truncated without a correctness/fairness cost.
Considered: giving every row a fixed proportion (e.g. `40% 35% 25%`) — rejected because dock content
height is genuinely variable (a numeric keypad vs. 4 choice options vs. results standings), and a
fixed proportion would either waste space on short dock content or clip tall dock content; letting
the map absorb the *actual* leftover space handles both without per-phase tuning.

### `height: 100dvh` + `overflow: hidden`, not `min-height: 100vh`
`vh`/`svh` don't solve the "mobile browser chrome resizes the visible viewport as you scroll" case
that motivates `dvh` (dynamic viewport height) specifically — and critically, this must be `height`
(a hard cap), not `min-height` (today's desktop rule, which lets content grow past it). Using
`min-height` here would silently reopen scroll the moment any phase's content is taller than one
screen, defeating the entire point of this change. Scoped to the mobile breakpoint only; desktop's
existing `min-height: 100vh`/`100svh` is untouched.

### `html, body, #root { overflow: hidden; overscroll-behavior: none }` as a backstop, mobile-only
Even with the grid correctly bounded, iOS rubber-banding/pull-to-refresh can still visually
"scroll" the page. This is belt-and-suspenders, scoped to the same breakpoint (via a class or
nested media query) so desktop keeps normal document scroll behavior.

### Remove `MapViewport`/pinch-zoom/pan and `RotateDeviceGate` entirely, all viewports (confirmed with user)
Two options were considered: (a) disable only under the mobile breakpoint, keep desktop zoom, or
(b) remove entirely. The user chose (b) — one simpler behavior everywhere, rather than a permanent
mobile/desktop behavioral split and ~250 lines of hand-rolled pointer-event/pinch/wheel/
stray-touch-recovery code kept alive for a niche desktop affordance whose original justification
(small touch targets) no longer applies post `abstract-map-rework`. `GameMap` renders directly,
still wrapped in a plain non-interactive sizing `div` (needed for the CSS height rule above) but
with no gesture handlers, transform, or touch-action juggling. `RotateDeviceGate` is removed
outright since forcing landscape directly contradicts "fits on one screen held naturally" —
there's no scenario where both requirements can coexist.

**Accessibility replacement**: `index.html`'s viewport meta has no `maximum-scale`/
`user-scalable=no` today and this change adds none, so native browser pinch-zoom-to-read-text
remains fully available — arguably a *better* affordance than the old map-only zoom, since it zooms
all UI text, not just the SVG. This must not regress: no new CSS in this change may set a global
`touch-action: none` (that would suppress native pinch-zoom along with layout scroll) — the
`overflow: hidden`/`overscroll-behavior: none` rules above only affect layout scroll, not the
browser's visual-viewport zoom.

### `RoundLimit` appended as the last positional DTO argument, not inserted mid-record
`GameViewDto` is a large positional record with no named arguments at its single construction site
in `RoomActor.cs`. Appending `RoundLimit` last (mirroring how `Language` was appended previously,
rather than inserted mid-list) avoids a silent argument-shift bug where an inserted-in-the-middle
parameter shifts every subsequent positional argument by one without a compiler error (C#
positional records only catch a *type* mismatch at that position, not a semantic one, if adjacent
fields happen to share a type).

### `roundsRemaining` computed at the point of use, not a third DTO field
`Math.max(0, view.roundLimit - view.currentRound)` is computed directly in `TopBar` rather than
precomputed server-side into a `RoundsRemaining` field. There is exactly one consumer today; a
third redundant field is unjustified surface area. If a second consumer appears later, revisit
centralizing the calculation in `src/Triviador.Client/src/lib/format.ts`.

### Round-progress text lives only in `TopBar`, not duplicated in `BattleScreen`'s in-dock heading
`BattleScreen.tsx`'s existing short "Round 4" heading stays unchanged. Dock vertical space is the
scarcest resource under the no-scroll constraint, and `TopBar` is always visible above the map in
every phase, so it's the one place that should carry the fuller "current/total/remaining" text —
duplicating it in the dock would cost vertical space for no added information.

## Risks / Trade-offs

- **[Risk] A long trivia question + 4 answer options may compress the map to a barely-visible
  sliver on a short phone**, since question text cannot be truncated (a correctness/fairness bug,
  not cosmetic) → Mitigation: not solved in this change; flagged as a fast-follow (audit question
  bank content for outlier length; consider a `clamp()`-based font-size reduction on question/option
  text under the mobile breakpoint to reduce the common case's vertical footprint).
- **[Risk] Roster compaction may truncate long player display names harder than today's
  full-width layout** (4 cards at ~360px width get ~85-90px each) → Mitigation: existing
  `.player-name` ellipsis truncation already handles this gracefully; verify visually with
  realistic (longer) names during the verification pass.
- **[Risk] `GameViewDto`/`RoomActor.cs` positional-argument edit could silently miscompile-adjacent
  if the argument count/order doesn't match** → Mitigation: `dotnet build` must pass, and the
  construction site's argument list is reviewed line-by-line against the record's parameter list
  during implementation, not just appended blindly.
- **[Risk] Removing pinch-zoom removes a real, if narrow, accessibility affordance for users who
  specifically zoomed the map (not general UI text)** → Mitigation: native browser pinch-zoom
  covers the same underlying need (reading small text) and is strictly more general; verified
  manually in the verification pass that no new CSS blocks it.

## Migration Plan

1. CSS: rework `.app-shell` and children under the mobile breakpoint (no-scroll layout).
2. Delete `MapViewport.tsx` and its CSS; mount `GameMap` directly.
3. Delete `RotateDeviceGate.tsx`, its mount point, its CSS, and its i18n keys.
4. DTO: `GameRules.RoundLimit` (Domain, unchanged) → `GameViewDto` → `RoomActor.cs` →
   `contracts.ts` → `TopBar` display + new i18n key.
5. Verification pass (see `tasks.md`): manual/Playwright screenshot checks across phases and
   viewport sizes, `tsc`/`dotnet build`, manual pinch-zoom-still-works and
   rotation-no-longer-prompts checks.
6. Rewrite the two affected specs (`mobile-viewport-interaction` REMOVED/ADDED sections,
   `client-presentation` ADDED section) and archive.

No persisted state or API versioning involved — pure client presentation plus one additive DTO
field; rollback is a standard git revert.

## Open Questions

None blocking — the one open design fork (mobile-only vs. global removal of map zoom) was resolved
with the user during planning: global removal.
