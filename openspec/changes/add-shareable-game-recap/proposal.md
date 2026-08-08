## Why

A finished game currently ends at `ResultsScreen`: a headline, the final roster, and a "copy result"
button that puts a plain-text summary on the clipboard. Nothing about a match survives past the
browser tab, and nothing is worth sending to a friend as a link — a clipboard paste renders as bare
text everywhere, including Telegram, this audience's primary sharing surface. This change gives a
finished game a permanent, shareable recap: a page summarizing the match (winner, standings,
highlights, final map), reachable by a link that renders a rich preview when pasted into Telegram,
persisted only when a player actually chooses to share it, and listed for later under a signed-in
player's account.

## What Changes

- **Client-side recap accumulation.** The client already diffs consecutive `GameViewDto` snapshots
  (`useGameTransitions`) to drive toasts; this change extends that same diffing into a persistent,
  whole-match log kept in `gameStore` (longest streak reached per player, every base-assault
  outcome, every golden-question moment, the resolved category-ban set), so a full recap can be
  assembled the instant the match reaches `Finished` with no new server round-trip.
- **Share, don't auto-save.** `ResultsScreen` gains a "Share recap" action beside the existing
  "Copy result" button. Only clicking it POSTs the locally-built recap to the server — a game nobody
  shares never touches the database, per the explicit requirement.
- **New `GameRecap` Postgres table** (EF Core, same `TriviadorDbContext`/migration pattern the
  existing `Accounts` tables use) storing the recap as JSON, keyed by a public `Guid` id, with a
  `Fingerprint` unique index so multiple players sharing the same finished match land on the same
  link instead of creating duplicates.
- **`GET /recap/{id}`** (a real path route, not a `#/...` hash route, so it works without JS) serves
  a version of the SPA shell with `og:title`/`og:description`/`og:image` meta tags injected
  server-side from the stored recap, so Telegram (and other link-preview crawlers) render a rich
  card; a real browser hitting the same URL gets the identical SPA, which renders the full recap
  page client-side. `GET /api/recaps/{id}/image.svg` renders a small on-the-fly summary image
  (winner, standings, a mini map) used as that `og:image`.
- **`GET /api/recaps/mine`** (authenticated) lists a signed-in player's shared recaps, surfaced from
  a new "My recaps" entry in the app's main menu — mobile-first, matching the rest of the client.
- **Configurable retention.** `Recap:RetentionDays` in `appsettings.json` (default 14, overridable
  via the `Recap__RetentionDays` env var so it can change without a redeploy), plus a
  `RecapJanitor` background service (mirroring the existing `RoomJanitor` pattern) that deletes
  expired recaps on a periodic sweep.
- **Avatar-photo compatibility.** A new shared `Avatar` client component centralizes avatar
  rendering (today: the existing emoji-glyph lookup); `PlayerRoster` and the new recap screens all
  render avatars through it, and the recap payload/DB row store only the opaque `avatarId` string —
  never a baked emoji glyph — so switching the avatar set to uploaded photos later touches exactly
  that one component (and the server's SVG summary-image generator) with no data migration.

## Capabilities

### New Capabilities
- `game-recap-sharing`: a finished game can be shared as a permanent, Telegram-preview-friendly
  recap link, created only on explicit share, retained for a configurable window, and listed for a
  signed-in sharer.

### Modified Capabilities
- `player-accounts`: a signed-in user can now list the game recaps they've shared, in addition to
  the existing username/avatar profile capabilities.

## Impact

- **New code**: `Triviador.Application/Recaps/*` (DTOs, `IRecapRepository` port, recap-building
  helpers shared with the client's mirrored logic where useful), `Triviador.Infrastructure/Recaps/*`
  (`GameRecap` entity, EF config + migration, `EfRecapRepository`, `RecapJanitor`,
  `RecapOptions`), `Triviador.Web/Recaps/RecapEndpoints.cs` (API + the OG-shell route + the SVG image
  route), `Triviador.Client/src/components/Avatar.tsx`, `Triviador.Client/src/screens/RecapScreen.tsx`,
  `Triviador.Client/src/screens/MyRecapsScreen.tsx`, `Triviador.Client/src/lib/recap.ts` (client-side
  accumulation/payload-building), `tests/e2e/specs/game-recap.spec.ts`.
- **Affected code**: `Triviador.Web/Program.cs` (DI, hosted service, new endpoints),
  `appsettings.json` (new `Recap` section), `gameStore.ts` (recap log accumulation),
  `ResultsScreen.tsx` (share button/flow), `App.tsx` (path-based routing for `/recap/:id` and
  `/recaps`, alongside its existing hash-based room routing), `AppMenu.tsx`/`LandingScreen.tsx` ("My
  recaps" entry), `PlayerRoster.tsx` (adopt the new `Avatar` component), `lib/avatars.ts` (becomes
  the implementation detail behind `Avatar.tsx` rather than being called directly from render code),
  `contracts.ts` (new recap DTO mirror).
- **No changes** to `Triviador.Domain`, the game engine, or any existing DTO shape — the recap
  payload is built from data already legitimately visible to the client via `GameViewDto`, not from
  new server-side game state.
