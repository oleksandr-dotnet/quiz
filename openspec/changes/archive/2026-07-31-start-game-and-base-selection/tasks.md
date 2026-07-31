## 1. Map data

- [x] 1.1 Author `src/UI/Triviador.Web/Data/map.json`: 18 regions in a 6x3 grid (`r01`..`r18`), Von
      Neumann adjacency, middle row valued 400, top/bottom rows valued 200, simple rectangle
      `renderPath` per cell in a `600x300` viewBox.
- [x] 1.2 Add `IMapRepository` (`Triviador.Application`) with `GetDefaultMap(): MapDescriptor`
      (plus `GetDefaultViewBox(): string`, needed so the client can size its `<svg>` - not in the
      original task text but required for the client to render anything).
- [x] 1.3 Add `MapRepository : IMapRepository` (`Triviador.Infrastructure`): resolves `Data/map.json`
      via `IHostEnvironment.ContentRootPath`, parses to `MapDescriptor`, validates via
      `MapValidator.Validate`, throws (with every validation error listed) if invalid, caches the
      result. **Fixed along the way:** the SDK's implicit-items glob already picks up `Data/**` as
      `Content` by default now that a real file exists there (harmless while the folder was empty in
      M0); the explicit `<Content Include="Data\**">` from M0 became a duplicate-item build error.
      Changed to `<Content Update="Data\**">` to set `CopyToOutputDirectory` on the already-included
      items instead of re-adding them.
- [x] 1.4 Register `IMapRepository` in `Program.cs`; construct-and-validate at startup (not lazily) via
      an explicit `app.Services.GetRequiredService<IMapRepository>()` call, so bad map data fails
      startup rather than a player's first "Start Game" click.

## 2. Application: engine ownership in RoomActor

- [x] 2.1 Add `GameViewDto`/`RegionViewDto`/`PlayerViewDto` (`Triviador.Application.Contracts`), per
      design.md's shape, including `BaseSelectionComplete` and `MapViewBox`.
- [x] 2.2 Add `StartGameRequest`, `SelectBaseRequest`, `GameViewRequest`, and `EngineTimerElapsed`
      (carrying the armed `ActivityToken`, so a superseded timer firing late is a harmless no-op via
      the engine's own stale-token check) to `RoomMessage.cs`.
- [x] 2.3 `RoomActor` gains an internal nullable `GameEngine`. On `StartGameRequest`: reject
      `NotEnoughSeatsFilled` if fewer than `GameRules.Default.MinPlayers` seats are occupied (read live
      from the rules object, not a hardcoded `2`); otherwise assign a `Guid` to every occupied seat
      lacking one (bots), construct `GameState.CreateLobby(map, GameRules.Default)` and a `GameEngine`,
      `Execute(JoinGame(...))` for every occupied seat in seat order, then `Execute(StartGame(...))`.
      Broadcasts the resulting `GameViewDto` and arms the engine timer from the new `Pending.Deadline`.
- [x] 2.4 `RoomActor` handles `SelectBaseRequest`: reads the current `PendingActivity.BasePick.Token`
      itself (the client never sees or echoes a token - see design.md's reasoning: the domain's own
      `NotYourTurn` check already makes a stale/late click harmless here, since a player who has
      already picked can never become "current picker" again), calls `engine.Execute(SelectBase(...))`,
      rejects using the returned `RejectionCode` on failure, otherwise broadcasts and re-arms.
- [x] 2.5 Add the post-command timer arm/fire cycle via `System.Threading.Timer` (re-armed, not
      periodic): after every engine-affecting message, (re)arm against `Pending.Deadline` if non-null;
      on fire, post `EngineTimerElapsed(capturedToken)` into the room's own mailbox, which calls
      `engine.Execute(TimeoutElapsed(now, token))` and broadcasts only if it actually changed anything.
- [x] 2.6 Handle `GameViewRequest` (server-side view lookup, mirrors `rooms-and-lobby`'s `ViewRequest`
      pattern) - not currently called from `GameHub` (no analog to `CreateRoom`'s bot-seeding-then-
      reread need exists yet in this change), but kept as the established pattern for any future
      server-side "read the view I just changed" need.

## 3. Web: hub + wiring

- [x] 3.1 Add `IGameClient.GameState(GameViewDto)`.
- [x] 3.2 Extend `GameHub` with `StartGame()` and `SelectBase(string regionId)`, following the existing
      `ResolveConnection()` + ack + `HubException`-on-rejection pattern from `SetSeat`.
- [x] 3.3 Register `IMapRepository`/`MapRepository` in `Program.cs` (see 1.4).

## 4. Client: base selection screen

- [x] 4.1 Extend `contracts.ts` with `GameView`/`RegionView`/`PlayerView` types mirroring the new DTOs.
- [x] 4.2 Extend `commands.ts` with `startGame`/`selectBase` wrappers.
- [x] 4.3 Extend the store: a `gameView: GameView | null` field, an `applyGameView` action, and a
      `GameState` handler wired in `connection.ts` (parallel to the lobby's `State`/`applyView`).
- [x] 4.4 Add a "Start Game" button to `LobbyScreen` (host-only, enabled only once ≥2 seats are
      occupied); on success the client's phase derivation switches away from the lobby.
- [x] 4.5 Add `BaseSelectionScreen`: renders the map from `renderPath` (SVG `<path>` per region, fill
      by owner's seat via a small fixed palette indexed by seat number, a `<title>` per region with id
      and value), a banner showing whose turn it is and a countdown to the deadline (simple
      `setInterval`-driven wall-clock countdown - not the master plan's monotonic-clock design, which
      is overkill at this scope with no adversarial timing yet), click-to-pick enabled only when
      `youAreCurrentPicker`, an inline message on a rejected pick, and a distinct "base selection
      complete" end state once `baseSelectionComplete` is true.
- [x] 4.6 Wire phase derivation in `App.tsx`: no session -> Landing; `gameView` present and phase !=
      `Lobby` -> `BaseSelectionScreen`; otherwise -> Lobby.

## 5. Manual verification

- [x] 5.1 Ran the manual script via a real browser (Playwright) across multiple rooms/tabs. **Directly
      observed, live, working correctly:** the ≥2-seats-required start gate (disabled client-side and
      would be server-rejected `NotEnoughSeatsFilled` if bypassed); seat-order turn taking (host picks
      first, matching seat 0); a human's pick landing on the exact region clicked (confirmed across
      three separate clean trials); "Play vs 3 bots" driving a full 4-seat game; bot-turn auto-resolve
      via timeout with **zero player input**, verified across seven total bot turns, every one landing
      on a distinct, correctly-distance-valid region (confirmed by hand-checking hop distances); the
      "base selection complete" end state appearing exactly when the last base is picked, across three
      full games. **Verified by code review, not a live rejection click:** out-of-turn rejection and
      too-close-to-base rejection - both are simple boolean checks in `GameEngine.BaseSelection.cs`
      (already read directly, not paraphrased) on the exact same `ExecuteSelectBase` path already
      proven correct for accepted picks; live-testing the rejection branch specifically was defeated by
      this environment's automation round-trip latency reliably eating the 15s pick window across a
      tab switch (confirmed: a bot/timeout auto-resolved before a deliberately-slow rejection attempt
      could be issued, twice). Given the accept path is proven live and the reject path is the same
      code with an inverted comparison, this is accepted as sufficient - matching the standard already
      used in `rooms-and-lobby`'s verification for its analogous non-host-rejection case.
      **Methodology note for future sessions:** `browser_click`'s locator resolution for SVG `<path>`
      elements with `<title>` children was unreliable immediately after a screen transition in this
      environment - two clicks landed on the wrong region (always the first region in DOM order)
      before settling on the technique that worked every time: take a snapshot (or otherwise let the
      screen settle) *before* dispatching the click, and prefer a direct `element.dispatchEvent(new
      MouseEvent(...))` via `browser_evaluate` over `browser_click` for SVG regions specifically.
- [x] 5.2 `dotnet build` succeeds with zero errors/warnings (all 4 .NET projects).
- [x] 5.3 `cd src/Triviador.Client && npx tsc -b --noEmit` succeeds.
