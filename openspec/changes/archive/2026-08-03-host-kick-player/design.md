## Context

`player-leave-and-takeover` already solved "a seat needs to keep playing without its human" for the
self-leave case: `RoomActor.HandleLeaveAsync`'s mid-game branch flips `seat.IsBot = true`,
clears `ConnectionId`, and calls `ScheduleBotMoves` if the leaving player currently holds the pending
activity. The domain engine (`Triviador.Domain`) has zero awareness of "bots" at all — a bot-controlled
seat is indistinguishable from a human one to `GameEngine`; `RoomActor` just submits the same commands
a human client would, through the same public `SelectBaseAsync`/`PickRegionAsync`/`SubmitAnswerAsync`/
`SelectAttackTargetAsync` methods.

That existing mechanism covers exactly one of the two territory dispositions this feature needs
("hand to a bot"). The other ("release territory to neutral") has no precedent anywhere in the
domain: every existing way a player's regions change hands is either land-grab awarding (to that same
player) or base-assault capture (`CaptureBase`, transferring everything to a specific attacker,
alongside `Eliminated`). There is no existing path that sets a region back to `OwnerId = null` once
the game has left `LandGrab`, and no existing path that removes a player from all future turn-taking
without crediting someone else as the winner of that territory.

Domain state that assumes "a player either keeps playing normally or is `Eliminated` via a specific
battle capture" appears in several places that a genuinely new "withdrawn, no attacker credited"
state must also account for: `ActiveParticipants()`, `AdvanceTurn`'s round-queue skip, `CheckEndConditions`,
`NextPlayerForBasePick`'s base-selection order, and `RegionPicks`' award queue advancement. All of
these currently only check `!player.Eliminated`.

## Goals / Non-Goals

**Goals:**
- A host-only, per-seat "Kick" action reachable from clicking a player, in the lobby and mid-game.
- Mid-game, the host explicitly picks the kicked player's territory disposition: bot takeover (reusing
  `player-leave-and-takeover`'s existing mechanism verbatim) or release to neutral (new).
- Release-to-neutral must never leave the engine waiting on a `TimeoutElapsed` that would grant the
  withdrawn player new territory (a base pick, a land-grab region, an attack target) — every pending-
  activity shape where the withdrawn player is the current required actor must be immediately rerouted
  past them, not merely left to time out.
- The kicked player cannot rejoin their old seat afterward, under either disposition.
- Preserve every existing domain invariant: `AssertInvariant`'s "Finished or Pending" after every
  `Execute`, canonical iteration order, no ambient time/randomness in `Triviador.Domain`, rejections as
  `CommandResult` never exceptions.

**Non-Goals:**
- Un-kicking / restoring a withdrawn player to human control within the same game (mirrors
  `player-leave-and-takeover`'s existing "not reversible" stance for self-leave).
- Forcibly severing the kicked player's SignalR connection from the server side. The client is
  expected to call `connection.stop()` itself upon receiving the `Kicked` notification — the same
  pattern `RoomClosed` already relies on today, which also performs no server-side abort.
- Proactively force-resolving a Question pending activity the withdrawn player was a participant in;
  it's left to the existing timeout fallback (see Decision D4).
- A generic reusable context-menu/popover component library — this change builds exactly what the
  kick UI needs, following `HowToPlayModal.tsx`'s existing dialog conventions.

## Decisions

### D1: `Withdrawn` is a new, separate `PlayerState` field, not a reuse of `Eliminated`

A kicked-and-released player and a battle-defeated player are different facts: `Eliminated` is always
paired with a specific attacker capturing a specific base (`BaseCaptured`/`PlayerEliminated`,
transfer-then-flag order per `battle-flow`'s Decision D9). Reusing `Eliminated` for a kick would mean
either fabricating a fictitious "attacker" for `BaseCaptured`'s sake, or having `PlayerEliminated` fire
with no matching capture event — both misrepresent what happened and would misdirect any future
client narrative/animation keyed off that pairing. `Withdrawn` is a plain sibling boolean, and every
place that currently means "this player is out of the game" (`ActiveParticipants`, `AdvanceTurn`'s
skip check) is extended to `!Eliminated && !Withdrawn` rather than folding one into the other.

### D2: Release-to-neutral is a new domain command (`WithdrawPlayer`), not an Application-layer-only trick

Bot takeover needs no domain change because the domain never distinguishes bot from human `PlayerId`s.
Release-to-neutral does need a domain change, because it mutates `RegionState.OwnerId` and player
turn-eligibility — state the domain owns and the Application layer must never mutate directly (per
this repo's "nothing outside Domain/Application knows the rules" boundary). `WithdrawPlayer(Instant At,
PlayerId PlayerId)` is dispatched through `GameEngine.Execute` exactly like every other command.

### D3: Immediate reroute for BasePick/RegionPicks/TargetSelection; no special handling for Question/RevealHold

Three pending-activity shapes name a *single specific player* as the required next actor, and their
`TimeoutElapsed` fallback would otherwise **assign that player new territory** if left alone
(`TimeoutBasePick` auto-picks a base, `TimeoutRegionPick` auto-picks a region, and — indirectly —
`TimeoutTargetSelection` would ask a question on the withdrawn player's behalf). `WithdrawPlayer` must
therefore actively reroute past the withdrawn player if they are that pending activity's current actor:
- `BasePick`: reuse `NextPlayerForBasePick`'s forward-then-wrap scan (now also skipping
  `Withdrawn`/`Eliminated` candidates), producing either the next player's `BasePickRequested` or, if
  none remain, `BaseSelectionCompleted` + `StartLandGrab` — the same tail shape `CompleteBasePick`
  already uses, minus assigning the withdrawn player a region.
- `RegionPicks`: advance `NextIndex` forward, skipping any award-queue entry whose player has become
  `Withdrawn`/`Eliminated` (the same skip-loop is added to `CompleteRegionPick`'s own advancement, so a
  player withdrawn while merely *queued*, not yet current, is still skipped correctly once their turn
  would otherwise arrive) — then request the next real picker, ask another land-grab question if free
  regions remain, or complete land grab.
- `TargetSelection`: call `AdvanceTurn(at)` again. The withdrawn player was already dequeued from
  `RoundQueue` when this activity was created, so this simply continues the same dequeue loop —
  extending that loop's existing lazy skip (`player is null || player.Eliminated`) to also check
  `Withdrawn` is what makes both this immediate reroute and every future round-queue rebuild correct.

By contrast, `Question` (LandGrab/Duel/BaseAssault) and `RevealHold` need no reroute: a `Question`'s
resolution already tolerates a missing submission via `TimeoutElapsed` filling `AnswerValue.None` for
whoever never answered (`ResolveQuestion`), which is exactly the outcome we want for a withdrawn
participant — no new territory is granted, the question just resolves once the deadline passes. This
is an accepted, bounded UX delay (at most one question's duration), not a correctness gap.

### D4: A defensive guard in `ResolveRevealHold` against crediting a withdrawn attacker

Narrow race: a player is kicked (release policy) during the ~4-second `RevealHold` window after
already winning a duel/assault, before that win's region/HP transfer has been applied. Without a
guard, `ResolveRevealHold` would still credit the transfer to `duel.Attacker`/`assault.Attacker` even
though they've since been withdrawn — resurrecting territory for a player who is supposed to be out.
Add a check before crediting any transfer: if the attacker is now `Withdrawn`, skip the transfer
(the contested region/HP simply stays as `WithdrawPlayer` already left it). This is a cheap guard
against a narrow window, not a redesign of `RevealHold`.

### D5: Kept `seat.PlayerId` set (not cleared) for a mid-game release-policy kick

`RoomActor`'s `Seat.IsOpen` is `!IsBot && PlayerId is null`. Mid-game, no seat should ever become newly
joinable (the domain's `JoinGame` command is Lobby-only), so a release-policy kick must leave
`seat.PlayerId` untouched — only `ConnectionId` and `PlayerToken` are cleared. This also keeps
`BuildGameView`'s `seatsByPlayerId` lookup finding a real (non-bot, disconnected) seat for that still-
present `GameState.Players` entry, so the client correctly shows them as disconnected rather than
falling into the "seat is null → treat as connected" branch that's specifically there for bots.

### D6: No server-side forced disconnect; the kicked client stops itself

`IRoomBroadcaster`/`SignalRRoomBroadcaster` only ever target a single connection
(`hub.Clients.Client(connectionId)`), never a SignalR group — there is no existing mechanism in this
codebase to forcibly abort an arbitrary connection from outside its own `Hub` instance, and building
one (tracking raw `HubCallerContext`s) would be new, invasive plumbing for a narrow benefit. The
existing `RoomClosed` notification already relies on the same "tell the client, let it disconnect
itself" pattern. `Kicked(reason)` follows exactly that precedent: the seat's `ConnectionId`/
`PlayerToken` are cleared server-side as part of the kick (so any further hub call bearing that stale
connection would already fail once the client's `OnDisconnectedAsync` → `ConnectionMap.Remove` runs),
and the client is trusted to call `connection.stop()` on receipt, matching this repo's general
trust model (players aren't defended against as adversarial, only structurally prevented from
impersonating each other via `ConnectionMap`).

## Risks / Trade-offs

- **[Risk]** A withdrawn participant in an in-flight Question delays that question's resolution until
  its timeout instead of resolving immediately → **Mitigation**: accepted per D3; bounded to one
  question's duration, and reusing the existing timeout fallback avoids adding a second resolution
  path that could drift from the first (the same reasoning `battle-flow`'s Decision D1 used to reject
  a parallel `ExecuteSubmitAnswer`).
- **[Risk]** Extending `ActiveParticipants`/`AdvanceTurn`/`NextPlayerForBasePick`/`CompleteRegionPick`
  in four different files is easy to get inconsistent → **Mitigation**: every extension is the same
  one-line shape (`!player.Eliminated` → `!player.Eliminated && !player.Withdrawn`, or an equivalent
  skip-loop), reviewed together as part of this change rather than landing piecemeal.
- **[Risk]** No E2E harness exists yet for base-selection/land-grab/battle phases (only `room-lobby`
  does) → **Mitigation**: `kick-player.spec.ts` builds the minimal harness it needs (drive through
  base selection and land grab using bot seats plus one human, per `bot-gameplay`'s existing "bots
  submit through the same public methods, deterministic enough to test against" precedent) rather than
  a full generic phase-harness project.

## Migration Plan

1. Domain: `PlayerState.Withdrawn`; `Commands.WithdrawPlayer`; `Events.PlayerWithdrawn`;
   `RejectionCode.PlayerAlreadyWithdrawn`; new `GameEngine.Withdrawal.cs`; the four skip-condition
   edits (D3); the `ResolveRevealHold` guard (D4); `GameState.Fingerprint()` /
   `Projection/SnapshotBuilder.cs` / `GameSnapshot.PlayerSnapshot` gain `Withdrawn`.
2. Application: `KickLandPolicy` enum; `RoomMessage.KickPlayerRequest`;
   `RoomActor.KickPlayerAsync`/`HandleKickPlayerAsync` (lobby seat-clear / bot-takeover reuse /
   `WithdrawPlayer` dispatch, per D5); `IRoomBroadcaster.SendKickedAsync`;
   `Contracts/GameViewDto.cs`'s `PlayerViewDto.Withdrawn`.
3. Web: `IGameClient.Kicked`; `SignalRRoomBroadcaster.SendKickedAsync`; `GameHub.KickPlayer`.
4. Client: `contracts.ts`/`commands.ts` additions; `Kicked` handler in `connection.ts`;
   `gameStore.kickedReason`/`kicked()`; player-click action menu + kick confirm modal (new
   components); a "you were kicked" takeover screen; `LobbyScreen.tsx`'s per-seat actions gain "Kick"
   for connected humans; `en.json`/`ru.json` keys.
5. `tests/e2e/specs/kick-player.spec.ts`: lobby kick; mid-game bot-takeover kick; mid-game
   release-land kick (including kicking the player who currently holds a pending BasePick/RegionPicks/
   TargetSelection activity, to exercise D3's reroute paths deterministically rather than by timing
   luck).
6. `dotnet build` and `npx tsc -b --noEmit` clean; Playwright suite green.

## Open Questions

- None blocking.
