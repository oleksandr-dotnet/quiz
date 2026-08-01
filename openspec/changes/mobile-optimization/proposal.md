## Why

Playtesting on phones shows the map is the weakest part of the mobile experience: the 16-region
Europe map packs eight small countries (Portugal, Ireland, Belgium, Netherlands, Switzerland,
Austria, Czechia, Denmark) into a fixed 1200×700 viewBox, which renders several of them well under a
44×44px touch target on a typical phone screen with no gap between borders — a high-misclick
surface. On top of that, the client has no pinch/pan zoom, no orientation guidance, and only one
responsive breakpoint, so a phone player is stuck viewing the whole board shrunk to fit a narrow
portrait column.

## What Changes

- Cut the map from 16 regions to the 8 large, comfortably-tappable ones (Spain, France, UK,
  Germany, Italy, Poland, Sweden, Ukraine), dropping the 8 small countries. **BREAKING**: the map
  content id changes (`europe-16` → `europe-8`), adjacency for the surviving regions changes, and
  any in-flight game or persisted state referencing a dropped region id is no longer valid — this
  repo has no persistence layer yet and no live games survive a deploy, so there is no migration
  concern in practice.
- Repair adjacency for the 8 survivors so the graph stays fully connected with no isolated region
  (Sweden's only neighbor, Denmark, is cut; Italy's neighbors Switzerland/Austria are cut) — see
  design.md for the exact adjacency table and the reasoning for the two new edges it adds
  (Germany–Italy, Germany–Sweden).
- Regenerate the client's baked country-outline geometry (`europeGeography.ts`) from the trimmed
  region list via the existing build-time generator script — no hand-editing of generated output.
- Add pinch-to-zoom and drag-to-pan on the map (new `MapViewport` wrapper, no new npm dependency:
  built on native Pointer Events), with a double-tap/double-click zoom toggle, mouse-wheel zoom for
  desktop, and a reset-view control.
- Add a dismissible "rotate your device" nudge for narrow portrait viewports during active gameplay,
  plus a best-effort Fullscreen + `screen.orientation.lock('landscape')` attempt on user gesture
  (Android Chrome-family only; silently unavailable elsewhere, e.g. iOS Safari).
- Raise touch-target sizes for dock buttons/options/keypad at the existing 900px breakpoint, add
  `touch-action` rules so page scroll and map pan/pinch stop fighting each other, and add
  `safe-area-inset` padding for notched phones in landscape.
- Add `viewport-fit=cover` to the viewport meta tag so `safe-area-inset-*` resolves.

## Capabilities

### New Capabilities
- `mobile-viewport-interaction`: pinch/pan/zoom on the game map, an orientation nudge with a
  best-effort landscape lock attempt, and minimum touch-target sizing for interactive controls on
  narrow viewports.

### Modified Capabilities
(none — `map-topology`'s requirements are already region-count-agnostic; trimming which regions
`map.json` lists is a content change, not a requirement change. Same for `game-setup-rules` and
`land-grab-flow`, which reference adjacency/eligibility generically and never a fixed region count.)

## Impact

- `src/UI/Triviador.Web/Data/map.json` — region list and adjacency trimmed (content only).
- `src/Triviador.Client/scripts/generate-europe-paths.mjs` and its output
  `src/Triviador.Client/src/components/map/europeGeography.ts` — regenerated for 8 regions.
- New `src/Triviador.Client/src/components/map/MapViewport.tsx`, wired into `App.tsx`'s map slot.
- New orientation-nudge component, wired into `App.tsx` or `AppShell.tsx`.
- `src/Triviador.Client/src/App.css`, `index.css` — mobile breakpoint touch-target/layout rules.
- `src/Triviador.Client/index.html` — viewport meta tweak.
- No changes to `Triviador.Domain`, `Triviador.Application` DTOs/contracts, or `contracts.ts` — this
  change is map content plus pure client presentation.
