## 1. Domain: state, commands, events, rejection code

- [x] 1.1 `PlayerState`: add `Withdrawn` (`bool`, `internal set`).
- [x] 1.2 `Commands.WithdrawPlayer(Instant At, PlayerId PlayerId)`.
- [x] 1.3 `Events.PlayerWithdrawn(PlayerId PlayerId, ImmutableArray<RegionId> ReleasedRegions)`.
- [x] 1.4 `RejectionCode.PlayerAlreadyWithdrawn`.
- [x] 1.5 `GameState.Fingerprint()` and `Projection/GameSnapshot.cs`'s `PlayerSnapshot` /
      `Projection/SnapshotBuilder.cs`: thread `Withdrawn` through alongside the existing `Eliminated`.

## 2. Domain: engine wiring

- [x] 2.1 `GameEngine.cs`: add `WithdrawPlayer` to the `Execute` dispatch switch.
- [x] 2.2 New `Engine/GameEngine.Withdrawal.cs`: `ExecuteWithdrawPlayer` — rejects `GameAlreadyFinished`/
      `WrongPhase` (Lobby), `UnknownPlayer`, `PlayerAlreadyWithdrawn` (also true if `Eliminated`);
      releases every region the player owns to `OwnerId = null`; sets `Withdrawn = true`; emits
      `PlayerWithdrawn`; then reroutes per Decision D3 depending on the current `Pending` shape
      (`BasePick`/`RegionPicks`/`TargetSelection` naming this player as current actor) — no action
      needed for `Question`/`RevealHold`.
- [x] 2.3 `GameEngine.LandGrab.cs`: `ActiveParticipants()` also excludes `Withdrawn`;
      `CompleteRegionPick`'s `NextIndex` advancement (via new shared `AdvanceRegionPickQueue`) skips
      `Withdrawn`/`Eliminated` award-queue entries.
- [x] 2.4 `GameEngine.BaseSelection.cs`: `NextPlayerForBasePick`'s two scan loops skip
      `Withdrawn`/`Eliminated` candidates (shared by 2.2's `BasePick` reroute via new
      `AdvanceBasePickPast`).
- [x] 2.5 `GameEngine.Battle.cs`: `AdvanceTurn`'s dequeue-loop skip condition extends to
      `player.Eliminated || player.Withdrawn`; added the Decision D4 guard in `ResolveRevealHold` (Duel,
      self-heal, and BaseAssault branches all skip crediting a withdrawn attacker).

## 3. Application: kick handling

- [x] 3.1 New `Hosting/KickLandPolicy.cs`: `enum KickLandPolicy { ReleaseLand, BotTakeover }`.
- [x] 3.2 `RoomMessage.cs`: `KickPlayerRequest(Guid RequestingPlayerId, Guid TargetPlayerId, KickLandPolicy LandPolicy, TaskCompletionSource<CommandAck> Reply)`.
- [x] 3.3 `RoomActor`: public `KickPlayerAsync(Guid requestingPlayerId, Guid targetPlayerId, KickLandPolicy landPolicy)`
      wrapper (mirrors `LeaveAsync`'s shape); `HandleKickPlayerAsync`:
      - reject `NotHost` / `CannotKickSelf` / `NotSeated`;
      - capture the target seat's `ConnectionId` before mutating;
      - Lobby (`_engine is null`): `seat.Clear()` regardless of `landPolicy`;
      - Mid-game + `BotTakeover`: same as `HandleLeaveAsync`'s mid-game branch, plus null out
        `seat.PlayerToken`;
      - Mid-game + `ReleaseLand`: `_engine.Execute(new WithdrawPlayer(...))`, reject on domain
        rejection, else clear `ConnectionId`/`PlayerToken` (keep `seat.PlayerId`, per Decision D5),
        `ArmEngineTimer()`, broadcast;
      - after mutating, if the captured `ConnectionId` was non-null, call
        `_broadcaster.SendKickedAsync(connectionId, reason)`.
- [x] 3.4 `IRoomBroadcaster.SendKickedAsync(string connectionId, string reason, CancellationToken ct = default)`.
- [x] 3.5 `Contracts/GameViewDto.cs`: `PlayerViewDto` gains `Withdrawn: bool`; wired `p.Withdrawn` into
      `RoomActor.BuildGameView`'s player-projection lambda.

## 4. Web

- [x] 4.1 `IGameClient.Kicked(string reason)`.
- [x] 4.2 `SignalRRoomBroadcaster.SendKickedAsync` → `hub.Clients.Client(connectionId).Kicked(reason)`.
- [x] 4.3 `GameHub.KickPlayer(Guid targetPlayerId, string landPolicy)`: `ResolveConnection()`, parse
      `landPolicy`, call `room.KickPlayerAsync`, `HubException` on rejection — same shape as every
      other hub method.

## 5. Client

- [x] 5.1 `contracts.ts`: `withdrawn: boolean` on `PlayerView`; `KickLandPolicy` union type.
- [x] 5.2 `commands.ts`: `kickPlayer(targetPlayerId, landPolicy)`.
- [x] 5.3 `connection.ts`: `conn.on('Kicked', reason => useGameStore.getState().kicked(reason))`, and
      stops the connection itself on receipt.
- [x] 5.4 `store/gameStore.ts`: `kickedReason` state + `kicked(reason)` action (mirrors `roomClosed()`).
- [x] 5.5 `components/PlayerRoster.tsx`: clickable `PlayerCard` (host-only, not the viewer's own card,
      not already withdrawn) opening a new `PlayerActionMenu` popover with a "Kick" item. Required a
      z-index fix on the card itself (not just the popover) so the popover's clickable area isn't
      intercepted by the next sibling card underneath it.
- [x] 5.6 New `KickConfirmModal` component (modeled on `HowToPlayModal.tsx`'s dialog conventions):
      single-step confirm in the lobby; land-policy choice (release vs. bot) + confirm mid-game.
- [x] 5.7 `components/LobbyScreen.tsx`: added a "Kick" per-seat host action for connected human seats
      (alongside the existing disconnected-seat actions), wired to the same modal in single-step form.
- [x] 5.8 A "you were kicked" message keyed off `kickedReason`, implemented by extending the existing
      `ConnectionBadge` (checked before its `closedReason` branch) rather than a separate full-screen
      component — same prominent, above-`LandingScreen` placement `closedReason` already used.
- [x] 5.9 `en.json`/`ru.json`: kick menu item, confirm dialog copy (lobby + mid-game variants),
      land-policy button labels, cancel, the "kicked" player-card badge, and the "You were kicked"
      message.

## 6. Verification

- [x] 6.1 `dotnet build` clean (Domain, Application, Infrastructure, Web).
- [x] 6.2 `cd src/Triviador.Client && npx tsc -b --noEmit` clean.
- [x] 6.3 New `tests/e2e/specs/kick-player.spec.ts`, all green (run repeatedly, no flakes observed):
      lobby kick (seat freed, old token can't reclaim it); mid-game bot-takeover kick (kicked while
      Bob is an unanswered participant in the very first land-grab question — the bot-controlled seat
      answers on its own and the game keeps moving); mid-game release-land kick (same trigger point;
      the released base region's owner marker disappears immediately, and — since nobody ever answers
      on the withdrawn player's behalf — the in-flight question is confirmed to still resolve via the
      existing timeout fallback rather than hanging). Deliberately did **not** time the kick to land
      exactly during Bob's own personal BasePick/RegionPicks/TargetSelection turn (the narrowest,
      highest-value case for the Decision D3 reroute code) — a real per-player deadline (as short as
      15s) proved too tight to hit reliably against this sandbox's actual request latency; that path is
      covered by code review instead (see design.md's Risks section) rather than a flaky E2E assertion.
      Pre-existing, unrelated finding while running the full suite: every test in `room-lobby.spec.ts`
      currently fails in this environment because `i18n/index.ts` defaults to Russian
      (`fallbackLng: 'ru'`, no stored preference) while that spec assumes English — not touched by, or
      related to, this change (verified `i18n/index.ts`/`LandingScreen.tsx` are untouched); worked
      around in the new spec by seeding `localStorage.triviador.locale = 'en'` per page.
