## 1. Server: recap DTOs and port

- [ ] 1.1 Add `Triviador.Application/Recaps/RecapPayloadDto.cs`: `RecapPayloadDto`,
      `RecapPlayerDto`, `RecapRegionOwnershipDto`, and a `RecapHighlightDto` tagged union
      (`BaseAssault`, `GoldenQuestion`, `CategoryBansResolved`) per design.md's Data Model.
- [ ] 1.2 Add `Triviador.Application/Recaps/IRecapRepository.cs`: `CreateOrGetAsync(fingerprint,
      roomCode, payloadJson, sharedByUserId, ct)` (upsert-by-fingerprint per design.md Decision 2,
      returns the row's `Id` either way), `FindAsync(id, ct)`, `FindSummaryAsync(id, ct)` (light
      read for the OG-shell/image routes), `ListForUserAsync(userId, ct)`, `DeleteExpiredAsync(now, ct)`.
- [ ] 1.3 Add `Triviador.Application/Recaps/RecapValidation.cs`: pure validation of a posted
      `RecapPayloadDto` (player-id set closed and consistent across `Players`/`WinnerPlayerIds`/
      `RegionOwnership`/`Highlights`; non-negative bounded scores/streaks/round count; string length
      caps on `RoomCode`/`DisplayName`/highlight fields) returning ok/rejection, per design.md
      Decision 1.

## 2. Server: persistence

- [ ] 2.1 Add `Triviador.Infrastructure/Recaps/Entities/GameRecap.cs` matching design.md's Data
      Model.
- [ ] 2.2 Register `DbSet<GameRecap> GameRecaps` and its `OnModelCreating` config (unique index on
      `Fingerprint`, index on `ExpiresAtUtc`, FK to `Users` nullable) in `TriviadorDbContext`.
- [ ] 2.3 Add EF migration `AddGameRecaps` (`dotnet ef migrations add AddGameRecaps --project
      src/Triviador.Infrastructure --startup-project src/UI/Triviador.Web`), additive only.
- [ ] 2.4 Add `Triviador.Infrastructure/Recaps/EfRecapRepository.cs` implementing
      `IRecapRepository`, mirroring `EfUserAccountRepository`'s style (the upsert path catches
      `DbUpdateException` on the unique-index race the same way `TrySetUsernameAsync` already does,
      then re-reads by fingerprint).

## 3. Server: retention

- [ ] 3.1 Add `Triviador.Infrastructure/Recaps/RecapOptions.cs` (`RetentionDays`, default `14`),
      bound from a new `Recap` section in `appsettings.json`.
- [ ] 3.2 Add `Triviador.Infrastructure/Recaps/RecapJanitor.cs` (`BackgroundService`), mirroring
      `RoomJanitor`'s existing periodic-sweep shape: wake hourly, call
      `IRecapRepository.DeleteExpiredAsync(clock.UtcNow)`.

## 4. Server: API endpoints

- [ ] 4.1 Add `Triviador.Web/Recaps/RecapEndpoints.cs`, `MapRecapEndpoints`, mirroring
      `AuthEndpoints`'s minimal-API style:
      - `POST /api/recaps`: validates the body via `RecapValidation`, computes the fingerprint,
        reads `SharedByUserId` from `ClaimsPrincipal` if authenticated (no `RequireAuthorization()`
        — anonymous sharing stays possible, per design.md), stores `ExpiresAtUtc = now +
        RecapOptions.RetentionDays`, returns `{ id }`.
      - `GET /api/recaps/{id}`: returns the full `RecapPayloadDto` (404 if missing/expired).
      - `GET /api/recaps/mine`: `RequireAuthorization()`, returns the signed-in user's shared
        recaps (summary shape: id, room code, finished-at, winner names, created-at).
      - `GET /api/recaps/{id}/image.svg`: renders the on-the-fly SVG summary image per design.md
        Decision 4 (winner banner, per-player score/avatar-glyph rows, region-ownership legend);
        404 (or a small "expired" placeholder SVG) if missing.
- [ ] 4.2 Add the crawler-facing shell route: `GET /recap/{id}` reads `wwwroot/index.html`,
      injects `og:title`/`og:description`/`og:image`/`og:url` (and the `image.svg` route as the
      image) from `FindSummaryAsync`, returns the augmented HTML; falls back to the unmodified SPA
      shell if the id is missing/expired. Registered before the existing
      `app.MapFallbackToFile("index.html")`.
- [ ] 4.3 Wire `IRecapRepository`, `RecapOptions`, `RecapJanitor`, and `MapRecapEndpoints()` into
      `Program.cs`; add the `Recap` section (default `RetentionDays: 14`) to `appsettings.json`.

## 5. Client: avatar seam

- [ ] 5.1 Add `components/Avatar.tsx` (`{ avatarId, size? }`) wrapping today's `avatarGlyph()`
      lookup from `lib/avatars.ts`.
- [ ] 5.2 Update `PlayerRoster.tsx`'s avatar rendering to use `Avatar` instead of calling
      `avatarGlyph` directly.

## 6. Client: recap accumulation

- [ ] 6.1 Add `lib/recap.ts`: a pure `buildRecapPayload(finalView, matchLog)` plus a
      `MatchLog` accumulator type mirroring `RecapPayloadDto`'s shape client-side.
- [ ] 6.2 Extend `gameStore.applyGameView` to update a running `matchLog` on every snapshot: max
      `answerStreak` seen per player, and — reusing `useGameTransitions`' diff logic (factor the
      pure diff function out of the hook into `lib/gameTransitions.ts` so both the hook and the
      store call the same code, no duplicated derivation) — append `baseCaptured`/
      `baseAssaultScoreAdjusted`/`categoryBansResolved` occurrences and golden-question moments
      (detected off `lastReveal`/`pendingReveal`'s `isGolden` flag plus rank-1 answers) to the log.
      Reset `matchLog` in `leaveGame`/`roomClosed`/`kicked` alongside the other per-match state.
- [ ] 6.3 Update `useGameTransitions.ts` to import the factored-out diff function from
      `lib/gameTransitions.ts` instead of computing it inline (behavior-preserving refactor).

## 7. Client: share flow

- [ ] 7.1 Add `api/recaps.ts`: `shareRecap(payload)` (POST `/api/recaps`, attaching
      `Authorization: Bearer` if signed in, same pattern as `authApi.ts`), `fetchRecap(id)`,
      `fetchMyRecaps()`.
- [ ] 7.2 Add a "Share recap" button to `ResultsScreen.tsx`'s `landing-actions` row, alongside the
      existing "Copy result" button: on click, calls `buildRecapPayload` + `shareRecap`, then shows
      the resulting `/recap/{id}` link (copy-to-clipboard, matching the existing `onCopyResult`
      error-toast pattern) and a Telegram share affordance
      (`https://t.me/share/url?url=...&text=...`, opened in a new tab — no new dependency needed).

## 8. Client: recap screens and routing

- [ ] 8.1 Add `screens/RecapScreen.tsx`: mobile-first (primary target per requirements) layout
      rendering `RecapPayloadDto` — header (winner/standings/room code/date), final map snapshot
      (reuse `GameMap` in read-only mode against `RegionOwnership`/`MapViewBox`), highlights list,
      per-player stat rows (via `Avatar`), and the same share-link/Telegram affordances as
      `ResultsScreen`. Fetches via `fetchRecap(id)` on mount; handles the not-found/expired case.
- [ ] 8.2 Add `screens/MyRecapsScreen.tsx`: list of the signed-in user's shared recaps
      (`fetchMyRecaps()`), each linking to `#recapId -> /recap/{id}`; empty state for a
      never-shared account; sign-in prompt if not authenticated.
- [ ] 8.3 In `App.tsx`, add a `window.location.pathname`-based check (parallel to the existing
      `urlRoomCode()` hash check) for `/recap/:id` and `/recaps`, rendering `RecapScreen`/
      `MyRecapsScreen` before the existing session/room bootstrap logic runs.
- [ ] 8.4 Add a "My recaps" entry to `AppMenu.tsx` (mobile) and the equivalent desktop surface
      (`LandingScreen.tsx`'s signed-in state), visible only when `authProfile` is set.
- [ ] 8.5 Add `RecapPayloadDto` and friends to `api/contracts.ts` (hand-mirrored, per this repo's
      existing convention).

## 9. E2E tests

- [ ] 9.1 Add `tests/e2e/specs/game-recap.spec.ts`: play a game to completion (vs bots), click
      "Share recap", confirm a `/recap/{id}` link is produced and that navigating to it (a second
      page/context, simulating the recipient) renders the recap without needing the original
      session.
- [ ] 9.2 Cover: a game where nobody clicks share never produces a recap reachable by any link
      (no way to enumerate ids, but assert no share-triggered network call occurred without the
      click).
- [ ] 9.3 Cover: two different players in the same finished game both clicking "Share recap"
      resolve to the same `/recap/{id}` link (fingerprint dedup, design.md Decision 2).
- [ ] 9.4 Cover: `GET /recap/{id}` for an unknown id returns the plain SPA shell (not a 500), and
      the client renders its not-found state.
- [ ] 9.5 Cover: an unauthenticated visitor sees a sign-in prompt on `/recaps`; a signed-in user
      who has shared a recap sees it listed.

## 10. Verification

- [ ] 10.1 `dotnet build` and `cd src/Triviador.Client && npx tsc -b --noEmit` both pass.
- [ ] 10.2 `dotnet ef database update` (or equivalent) applies cleanly against a local Postgres.
- [ ] 10.3 Manually paste a shared `/recap/{id}` link into Telegram (or a preview-debug tool) and
      confirm a title/description/image card renders.
- [ ] 10.4 Manually verify the "My recaps" list on a mobile-width viewport.
