## Why

The current board is 18 fantasy-named jigsaw-tile regions with no visible adjacency, all-English trivia
content, and a raw `<input type="number">` for numeric answers. Playtesting calls for the game to read
as a real, recognizable place (a Europe-style territory graph), to serve a Russian-first audience with
an English fallback, and to give numeric answers a faster, thumb/mouse-friendly input affordance. All
three land together because they touch the same region-name and question-content path through the
engine and client.

## What Changes

- Replace the 18 fantasy regions with **16 European countries starting from Spain**, laid out and
  rendered as a **node-and-edge graph** (country nodes with visible adjacency connector lines) instead
  of an edge-to-edge tiled landmass. **BREAKING**: `map.json` content and `RegionDescriptor`'s
  rendering fields change shape (position + radius replace a hand-authored jigsaw `RenderPath`).
- Add a **room-level `Language` setting** (`Russian` default, `English` selectable), chosen once at
  room creation and stored in `GameState`, that determines both which language's question bank is
  dealt during play and which localized region name is projected to every client in that room. All
  players in a room see the same language for shared/broadcast content — no per-player divergence.
- Add **Russian translations for the full question bank** (23 questions) alongside the existing English
  text, keyed by the same question ids.
- Add **react-i18next** to the client with `ru` (default) and `en` resource bundles covering every
  hardcoded UI string across `App.tsx` and all screens/components, plus a language switcher.
- Replace the plain numeric `<input>` in `QuestionCard.tsx` with an **on-screen numeric keypad**
  (digit buttons, backspace, submit) that stays in sync with direct physical-keyboard typing into the
  same value.

## Capabilities

### New Capabilities
- `localization`: room-level `Language` selection, i18n resource system for UI chrome, and
  language-driven selection of question-bank text and region display names.

### Modified Capabilities
- `map-topology`: region roster becomes 16 European countries starting from Spain; `RegionDescriptor`
  gains a graph position (center + radius) alongside (or replacing) the hand-authored `RenderPath`, and
  region display name becomes locale-dependent instead of a single fixed string.
- `game-setup-rules`: room creation (`StartGame`/room-creation command) gains a `Language` selection
  that is fixed for the room's lifetime and never re-derived from ambient state, preserving replay
  determinism.
- `client-presentation`: the map renders as a graph (nodes + adjacency connector lines) rather than a
  tiled landmass; the numeric answer affordance becomes a clickable on-screen keypad in addition to
  physical-keyboard input; all client-rendered strings are looked up from the active locale's resource
  bundle instead of being hardcoded literals.

## Impact

- **Domain**: `RegionDescriptor`, `MapValidator` (`Triviador.Domain/Map`), `GameRules`/`GameState`
  (new `Language` concept), `QuestionPurpose`/question-selection code path in
  `Triviador.Domain/Engine`.
- **Application**: `Contracts/GameViewDto.cs` (localized region name, room language field), any
  `StateProjector`-equivalent projection logic, `RoomActor`/`RoomMessage` (room-creation now carries a
  language choice).
- **Infrastructure**: `Content/MapRepository.cs`, `Content/QuestionRepository.cs` (or equivalent),
  `Data/map.json`, `Data/questions/questions.json` (or a new locale-keyed question file).
- **Client**: `src/components/map/GameMap.tsx`, `RegionShape.tsx`, `src/components/QuestionCard.tsx`
  (new keypad component), `src/App.tsx` and every screen under `src/screens/`, `src/api/contracts.ts`,
  `package.json` (new `react-i18next`/`i18next` dependency), new `src/i18n/` resource files.
- No existing test suite (Playwright e2e tooling only) — manual/Playwright verification covers this
  change.
