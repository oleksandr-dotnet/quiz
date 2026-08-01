## Context

Today: `RegionDescriptor` (`Triviador.Domain/Map/RegionDescriptor.cs`) is `(Id, Name, Value, RenderPath,
LabelX, LabelY, AdjacentTo)` — `Name` is a single fixed string and `RenderPath` is a hand-authored SVG
polygon path tiled edge-to-edge with its neighbors (18 regions, `Data/map.json`). The client
(`GameMap.tsx`) draws these paths directly and never draws adjacency as lines. Trivia content
(`Data/questions/questions.json`) is English-only, no locale field, loaded by
`Infrastructure/Content/QuestionRepository.cs`/`QuestionDealer.cs`. `GameRules` (a plain record with
`Default`/`Marathon` presets) is constructed once in `RoomActor.HandleStartGameAsync` and carried
unchanged for the room's life via `GameState`. Room creation itself happens earlier, in
`GameHub.CreateRoom(displayName, botSeats)`, before any `GameRules`/`GameState` exists — the room sits
in a lobby (tracked by seats on `RoomActor`) until `StartGame` builds the engine. The client has zero
i18n today (react-i18next not installed); every string is an inline JSX literal across `App.tsx` and
every screen/component. `QuestionCard.tsx` takes numeric answers via a plain `<input type="number">`.

## Goals / Non-Goals

**Goals:**
- Render the map as a recognizable graph of 16 European countries (Spain first) with visible
  connector lines between adjacent countries, replacing the tiled-landmass look.
- Let a room fix its language (Russian default, English alternative) once at creation, and have that
  single choice drive both the question language dealt during play and the region names every client
  in that room sees — no per-player divergence, no re-derivation after creation (replay-safe).
- Give the client a full Russian-default / English-fallback UI via react-i18next.
- Replace the raw numeric `<input>` with a clickable on-screen keypad that stays in sync with direct
  keyboard typing.

**Non-Goals:**
- Per-player UI language independent of the room's game-content language (out of scope — one room,
  one language, for both chrome and content, keeps `StateProjector`/DTOs simple and avoids asking "what
  language does the client render an in-flight, still-secret question in" for a player who hasn't
  loaded translations for the room's language yet).
- Adding more than two locales, or a translation-management pipeline — `ru.json`/`en.json` are
  hand-maintained like the TS DTO mirror already is.
- Changing the jigsaw-tile `RenderPath` mechanism for anything other than the map redesign itself (base
  eligibility, adjacency-distance queries, etc. are unaffected — `AdjacencyIndex` only cares about the
  `AdjacentTo` graph, not pixel geometry).

## Decisions

### Region model: add position + radius, keep RenderPath as a derived circle
`RegionDescriptor` becomes `(Id, NameEn, NameRu, Value, CenterX, CenterY, Radius, LabelX, LabelY,
AdjacentTo)`. `RenderPath` is dropped from the descriptor and instead computed at the edge
(`MapRepository`/client) as a simple circle path from `CenterX/CenterY/Radius` — a node-and-edge graph
doesn't need hand-authored jigsaw polygons, and generating a circle path is one line, so there is no
reason to keep hand-drawn SVG paths in content data. `LabelX/LabelY` stay separate from
`CenterX/CenterY` (kept as an explicit override) since a country's name/value badge may want a slightly
different anchor than its node center once rendered. **Alternative considered**: keep `RenderPath` as
authored content and add position fields alongside it — rejected because it doubles the content authors
have to keep in sync (move a node, forget to redraw its path) for no benefit once nodes are simple
circles.

Localized name: two plain fields (`NameEn`, `NameRu`) rather than a `Dictionary<string,string>` —
matches the two-locale, hand-maintained non-goal above and keeps `MapValidator`'s "missing display
name" check simple (both must be non-empty).

`MapValidator` gains no new structural rule beyond checking both name fields are non-empty; region
count (16), roster, and adjacency shape are pure content in the new `map.json`, not enforced by the
validator (it doesn't hardcode "18" today either).

### Room language: a `Language` enum on `GameRules`, chosen at `CreateRoom`, fixed thereafter
`GameRules` gains `Language Language = Language.Russian` (new two-value enum in
`Triviador.Domain.State`, alongside the existing rule constants it already owns per CLAUDE.md's "every
tunable lives on GameRules" convention). `GameHub.CreateRoom(displayName, botSeats, language)` passes
the choice down to `RoomFactory`/`RoomActor`, which holds it as room state through the Lobby period and
substitutes it into `GameRules.Default with { Language = language }` at `HandleStartGameAsync` — the
same place `GameRules.Default` is already constructed today. Once `GameState.CreateLobby` is called the
value is frozen inside `GameState.Rules`, exactly like every other rule, so replaying `(seed, command
log)` reproduces the same language deterministically with no ambient lookup.
**Alternative considered**: a per-request `Accept-Language`-style header read at projection time —
rejected because it would let two players in the same room see different question/region text for the
same broadcast `QuestionAsked` event, breaking "every domain event must be safe to broadcast verbatim"
(the event would need to carry both languages, or the server would need to know per-viewer language for
content that's supposed to be identical for every participant of a shared question).

### Locale-aware projection lives in `RoomActor.BuildGameView`, not a new layer
`BuildGameView` (today ~`RoomActor.cs:560`) already assembles every DTO from `GameState` per viewer.
Region name selection (`r.NameEn` vs `r.NameRu` based on `state.Rules.Language`) and question text
selection happen right there — no new `StateProjector` class is introduced (none exists yet;
`RoomActor.BuildGameView`/`BuildView` already are that boundary in practice). Question content needs a
locale-keyed bank: `QuestionRepository`/`QuestionDealer` load `questions.json` with an added `textRu`
(and `optionsRu`/`unitRu`) alongside the existing English fields per question id, and `ToPromptDto`
picks the field set matching `state.Rules.Language` when building `QuestionPromptDto`. Keeping both
languages on every question record (rather than two separate files) means one `MinDeck`-style validity
check still guarantees every question has both translations, instead of two files silently drifting out
of sync in length.

### Client: react-i18next with a flat key namespace, no per-screen namespacing
Single `src/i18n/resources/ru.json` + `en.json`, flat keys grouped by screen prefix
(`landing.*`, `lobby.*`, `landGrab.*`, `battle.*`, `results.*`, `question.*`, `app.*`, `common.*`) —
i18next namespaces would be overkill for ~45 keys in a small SPA. Locale is picked once from the room's
`Language` (delivered on `GameViewDto`/`RoomViewDto`) rather than browser locale, so the client's chrome
matches the room's chosen language exactly per the "one room, one language" goal above; before a room
exists (the landing screen), the client falls back to a `localStorage`-persisted choice defaulting to
`ru`, with a small language toggle on that screen only (the toggle disappears once inside a room, since
the room's language is fixed).

### Numeric keypad: new `NumericKeypad` component, same string state as physical typing
`QuestionCard.tsx`'s existing `numericInput` (string) state stays the single source of truth. A new
`src/components/NumericKeypad.tsx` renders digit buttons 0-9, backspace, and submit, each button
`onClick` appending to / trimming `numericInput` via the same setter `onChange` already uses — so a
mouse click and a physical keydown both go through one code path and can interleave freely. The existing
`<input>` is kept (not removed) but restyled as a read-only display of the current value so a screen
reader / power user typing on a physical keyboard still sees standard focus/typing behavior and
`onKeyDown`'s Enter-to-submit keeps working unchanged; the keypad buttons are an additional affordance,
not a replacement input element. **Alternative considered**: fully replace the `<input>` with a
non-focusable div — rejected, it would break physical-keyboard-first play (accessibility, keyboard-only
users, and the existing `data-testid="tip-input"` Playwright hook) for no gain.

## Risks / Trade-offs

- [16-country roster/adjacency drawn from real geography is a simplification, not a strict atlas] →
  acceptable since gameplay only needs a connected graph with plausible relative positions, not
  cartographic accuracy; content-only, easy to tweak post-hoc in `map.json`.
- [Adding `Language` to `GameRules` changes its record shape] → additive only (new field with a
  default), no existing call site breaks; `GameRules.Default`/`Marathon` presets keep compiling
  unchanged since C# record `with`-defaults apply.
- [Dropping `RenderPath` from `RegionDescriptor` is a breaking content-schema change] → confined to
  `map.json` + the two Domain/Infrastructure/Client files that read it; no persisted save state exists
  yet (rooms are in-memory, no migration needed).
- [Question bank doubling every field for two languages risks the two texts drifting in meaning] →
  mitigated by keeping both languages on the same JSON record per question id (one place to edit, one
  validity check), not two parallel files.
- [Locking UI chrome language to the room's language removes a "play in Russian, read English UI"
  option] → accepted per Non-Goals; can be revisited later without touching this change's DTOs if a
  real need shows up.

## Migration Plan

No persisted state / no production deployment yet (rooms are in-memory, single milestone-based repo) —
this ships as a normal in-place change: update `map.json` and `questions.json` content, land the
Domain/Application/Infrastructure/Client edits together, `dotnet build` + client typecheck, then
Playwright-verify a full room (create with each language, base-select, land-grab a question in each
language, submit a numeric answer via keypad and via physical keyboard).

## Open Questions

- Exact final 16-country roster/adjacency/positions: drafted separately as content (Spain-first, 16
  countries, real rough adjacency) — to be dropped into `map.json` as-is unless review surfaces a
  connectivity or overlap problem.
