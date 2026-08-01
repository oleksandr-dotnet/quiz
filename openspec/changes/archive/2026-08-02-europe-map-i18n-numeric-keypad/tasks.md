## 1. Domain: region model and room language

- [x] 1.1 Change `RegionDescriptor` (`Triviador.Domain/Map/RegionDescriptor.cs`) to
  `(RegionId Id, string NameEn, string NameRu, int Value, double CenterX, double CenterY, double
  Radius, double LabelX, double LabelY, ImmutableArray<RegionId> AdjacentTo)`, dropping `RenderPath`.
- [x] 1.2 Update `MapValidator` to require both `NameEn` and `NameRu` non-empty per region (replacing
  the single-`Name` check), keeping the existing duplicate-id/value/adjacency-symmetry/connectivity
  checks unchanged.
- [x] 1.3 Add a `Language` enum (`Russian`, `English`) to `Triviador.Domain.State`.
- [x] 1.4 Add `Language Language = Language.Russian` to `GameRules`, confirming `GameRules.Default`
  and `GameRules.Marathon` still compile unchanged.

## 2. Content: map and questions

- [x] 2.1 Rewrite `Data/map.json` as 16 European countries starting from Spain (`NameEn`/`NameRu`,
  `CenterX/CenterY/Radius`, `LabelX/LabelY`, symmetric `adjacentTo`), using the drafted roster/layout
  as the starting content; adjust only if validation or visual overlap requires it.
- [x] 2.2 Update `MapRepository.cs` to read the new `map.json` shape and derive a circle `RenderPath`
  (or pass `CenterX/CenterY/Radius` straight through, if `RenderPath` is dropped from the descriptor
  entirely) into whatever `RegionDescriptor`/DTO field the client-facing layer expects.
  Confirm `MapRepository`'s own validation call still runs against the new schema.
- [x] 2.3 Extend `Data/questions/questions.json` (or `QuestionRepository`'s loaded shape) so every
  `choice` question carries `textRu`/`optionsRu` and every `tip` question carries `textRu`/`unitRu`
  alongside the existing English fields, using the drafted Russian translations for all 23 existing
  questions.
- [x] 2.4 Update `QuestionRepository`/`QuestionDealer` to fail startup if any question is missing
  either language's text (mirroring the existing malformed-content startup-failure pattern).

## 3. Application: room creation and locale-aware projection

- [x] 3.1 Add a language parameter to `GameHub.CreateRoom` (default Russian if omitted) and thread it
  through `RoomFactory`/`RoomActor` as room state held through the Lobby period.
- [x] 3.2 In `RoomActor.HandleStartGameAsync`, build `GameRules.Default with { Language = <room's
  chosen language> }` instead of the bare `GameRules.Default`.
- [x] 3.3 In `RoomActor.BuildGameView`, select `r.NameEn`/`r.NameRu` per `state.Rules.Language` when
  constructing each `RegionViewDto.Name`.
- [x] 3.4 In `RoomActor`'s `ToPromptDto` (or equivalent), select the English or Russian text/options/
  unit per `state.Rules.Language` when constructing `QuestionPromptDto`.
- [x] 3.5 Add a `Language`/locale field to `RoomViewDto` and/or `GameViewDto` so the client can render
  its chrome in the room's language, and mirror the new field in `contracts.ts`.
- [x] 3.6 Update `contracts.ts` for the `RegionView`/map DTO shape change (position/radius fields
  replacing/joining `renderPath` if the client now derives the circle itself) to match whatever
  `GameViewDto` ends up sending after 2.2/3.5.

## 4. Client: map as a graph

- [x] 4.1 Update `GameMap.tsx` to render each region as a circle/blob node at its projected
  center/radius instead of drawing a hand-authored jigsaw `renderPath`.
- [x] 4.2 Add a connector-line layer to `GameMap.tsx` that draws one line per adjacent region pair
  from the current `GameView`'s region data (dedup each pair so it's drawn once, not twice).
- [x] 4.3 Adjust `RegionShape.tsx`'s claim-wash/eligibility/contested-marker overlays to work with the
  new circle geometry instead of arbitrary polygon paths.
- [x] 4.4 Verify label/value badge positioning (`labelX/labelY`) still reads cleanly against the new
  16-country layout; adjust per-region `labelX/labelY` in `map.json` if any label collides with its
  node or an adjacent node.

## 5. Client: i18n

- [x] 5.1 Add `react-i18next`/`i18next` to `package.json`.
- [x] 5.2 Create `src/i18n/` with `resources/ru.json` (default) and `resources/en.json`, seeded from
  the drafted key inventory, and an i18next init module wired into `main.tsx`/`App.tsx`.
- [x] 5.3 Wrap every hardcoded string in `App.tsx`, `LandingScreen.tsx`, `LobbyScreen.tsx`,
  `BaseSelectionScreen.tsx`, `LandGrabScreen.tsx`, `BattleScreen.tsx`, `ResultsScreen.tsx`, and
  `QuestionCard.tsx` with `t('<key>', { ...interpolation })`, using the drafted key inventory's
  `keyUsage` notes to match variables correctly.
- [x] 5.4 Add a language toggle on `LandingScreen` (pre-room) that persists the choice to
  `localStorage`, defaulting to `ru`.
- [x] 5.5 Once connected to a room, switch the active i18next locale to the room's projected
  `Language` field (from task 3.5) rather than the pre-room `localStorage` choice.

## 6. Client: numeric keypad

- [x] 6.1 Create `src/components/NumericKeypad.tsx`: digit buttons 0-9, backspace, submit, wired to
  append/trim the same `numericInput` string state `QuestionCard.tsx` already owns.
- [x] 6.2 Wire `NumericKeypad` into `QuestionCard.tsx` alongside the existing `<input
  data-testid="tip-input">` (kept, restyled as a value display), preserving the existing
  `onKeyDown`/Enter-to-submit physical-keyboard path.
- [x] 6.3 Confirm mixed input (some digits via keypad clicks, some via physical typing) produces one
  consistent value with no duplication or dropped characters.

## 7. Verification

- [x] 7.1 `dotnet build` succeeds across all layers.
- [x] 7.2 `cd src/Triviador.Client && npx tsc -b --noEmit` succeeds.
- [x] 7.3 Playwright: create a room (default Russian), verify the map renders as 16 connected European
  country nodes with visible connector lines, complete base selection, and confirm land-grab question
  text and region names render in Russian.
- [x] 7.4 Playwright: create a room with English explicitly selected and confirm question text and
  region names render in English instead.
- [x] 7.5 Playwright: on a numeric (`tip`) question, submit an answer using only on-screen keypad
  clicks, then on another using only physical keyboard typing, then on another mixing both, and
  confirm all three submit the intended value.
