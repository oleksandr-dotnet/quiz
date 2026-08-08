## Context

The server never sends the client a raw event stream — only full `GameViewDto` snapshots (see
`RoomActor`'s broadcast methods and `useGameTransitions`'s own doc comment: "the server broadcasts
only full snapshots... this is the only way the client learns what just happened"). Everything the
client could ever put in a recap — final scores, final territory ownership, each player's
`AnswerStreak` at any point, which base-assault question resolved which way, whether a reveal was
golden — is something the client has *already legitimately seen* on the wire during play, the same
information `PlayerRoster`, `ResultsScreen`, and every in-game toast already render. Building a
recap is therefore a client-side bookkeeping problem, not a new anti-cheat surface: unlike
`QuestionAsked`/`QuestionPrompt` (which deliberately never carries an answer field so there is no
code path that could leak one early — see CLAUDE.md), nothing about a *finished* game's own outcome
is secret from the players who just played it.

Player accounts already exist end to end (`Triviador.Infrastructure/Accounts`, JWT bearer auth,
`AuthEndpoints`) — this change adds one more table and one more `Ef*Repository` alongside the
existing `TriviadorDbContext`, not a new subsystem.

## Goals / Non-Goals

**Goals:**
- A recap is persisted if and only if a player clicks "share" — never automatically at game end.
- Every player who shares the *same* finished match gets the *same* permanent link.
- The link renders a rich, informative preview in Telegram without requiring the recipient to open it.
- Retention is operator-configurable without a redeploy, and old recaps are actually cleaned up.
- Swapping the avatar set from emoji to uploaded photos later requires no recap data migration.

**Non-Goals:**
- No server-authoritative reconstruction of the recap from `RoomActor`'s live state — see Decision 1.
- No photo-upload pipeline — only the rendering seam that will make adding one later a
  single-component change (`Avatar.tsx` + the SVG summary-image generator).
- No abuse/rate-limiting beyond payload shape/size validation — acceptable at this project's current
  scale; flagged as a risk to revisit if it's ever actually abused.
- No PNG rasterization of the summary image — SVG only for v1; flagged as a risk below.
- No per-recap privacy tiers — an unguessable `Guid` id is this game's existing informal access
  model (identical in spirit to a room code).

## Decisions

### 1. The client builds the recap payload; the server validates shape, not gameplay truth
Rejected alternative: have `RoomActor` accumulate a recap-relevant event log itself (it already sees
every `IGameEvent` batch from `GameEngine.Execute` before broadcasting) and hold an authoritative
draft in memory until a "share" command asks it to persist. This is the more "obviously correct"
design by the codebase's usual anti-cheat standard, but that standard exists to stop a client from
*learning something it shouldn't yet know* (an in-flight answer, the question deck, another
player's pending pick) — none of which applies to a *finished* game's own outcome, which every
viewer already legitimately received. Building it server-side would mean either keeping full rooms
alive in memory well past `RoomJanitor`'s idle-eviction window (to survive a "share" click that might
come minutes after the results screen appears) or duplicating the same highlight-detection logic
`useGameTransitions` already has, twice, for no security benefit. The server instead validates the
posted payload's *shape* (player ids form a closed, internally-consistent set; scores/streaks/round
counts are non-negative integers within sane bounds; string fields are length-capped) — enough to
stop a malformed or hostile payload from corrupting storage or the OG-image renderer, without
re-deriving gameplay truth.

### 2. Same-match dedup via a deterministic fingerprint, not a server-issued match id
Two different players in the same room can each click "share" independently, each with their own
client-built payload. To avoid two near-duplicate rows (and two different links) for one match, the
server computes `Fingerprint = SHA256(roomCode, sorted playerIds, roundsPlayed, sorted
winnerPlayerIds)` and enforces a unique index on it: the first POST for a given fingerprint inserts
the row (and is the one whose `SharedByUserId` sticks, if signed in); every subsequent POST for the
same fingerprint is treated as a successful share and just returns the existing row's id. An exact
rematch in the same room producing an identical fingerprint (same players, same round count, same
winners) is an accepted, extremely unlikely edge case — not worth a wall-clock timestamp in the
fingerprint, which would reintroduce the "two sharers, two rows" problem for the far more common
case of two players clicking share a few seconds apart.

### 3. The permalink is a real path (`/recap/{id}`), not a hash route
The app's existing room routing (`#/room/XXXX`) is a hash fragment, which is invisible to a
link-preview crawler — Telegram's fetcher only ever sees the document the server returns for the
path, never anything a client-side router would do with a `#...` fragment. `GET /recap/{id}` is
therefore a real ASP.NET route, registered before the existing `MapFallbackToFile("index.html")`,
that reads `wwwroot/index.html`, injects `<meta property="og:*">` tags computed from a light,
id-only DB read (title/description text plus the `image.svg` URL), and returns that augmented HTML
— unmodified otherwise, so the exact same JS bundle loads and the client-side app takes over
identically to any other page load. If the id doesn't exist or has expired, the handler falls back
to the plain, unmodified SPA shell (which then renders a "not found" state) rather than erroring.
`App.tsx` gains a small `window.location.pathname`-based check (parallel to, not replacing, its
existing `urlRoomCode()` hash check) for `/recap/:id` and `/recaps`, routing to the two new screens
before any of the existing session/room logic runs.

### 4. `og:image` is a server-rendered SVG, generated on demand, not stored
`GET /api/recaps/{id}/image.svg` regenerates the summary image from the stored `PayloadJson` on
every request rather than persisting image bytes — cheap at this scale, and guarantees the image can
never drift from the payload it summarizes. It draws a small legend (winner banner, per-player
score/avatar-glyph rows, region-ownership swatches) using the same `MapViewBox`/region-ownership
data the payload already carries, not a literal redraw of `GameMap`'s SVG.

### 5. Avatar rendering: one seam on the client, one on the server, data stays opaque
Today `avatarGlyph(avatarId)` is called directly at each render site (just `PlayerRoster.tsx`
currently). This change introduces `components/Avatar.tsx` as the only call site of that lookup, and
routes `PlayerRoster` and both new recap screens through it. `RecapPlayerDto.AvatarId` on the wire
and in the DB is the same opaque id (`"fox"`, `"owl"`, ...) already used everywhere else — never a
resolved glyph. The server's SVG generator needs its own tiny id→glyph table (mirroring
`AvailableAvatars`/the client's `EMOJI` map, an already-accepted hand-written-mirror pattern per
CLAUDE.md's note on `contracts.ts`). When photo avatars ship, only `Avatar.tsx` and this one
server-side table change; every stored recap renders the new art with no backfill.

### 6. Retention is computed at write time, not re-evaluated on read
`ExpiresAtUtc = CreatedAtUtc + RecapOptions.RetentionDays` is stored once, at insert. Changing the
config later only affects newly created recaps — it does not retroactively extend or shorten the
life of rows already written. `RecapJanitor` (a `BackgroundService`, same shape as `RoomJanitor`)
wakes on a fixed interval (e.g. hourly) and deletes rows where `ExpiresAtUtc < now`.

## Data Model

```
GameRecap
  Id              Guid      PK, also the public share id
  Fingerprint     string    unique index (see Decision 2)
  RoomCode        string
  CreatedAtUtc    DateTimeOffset
  ExpiresAtUtc    DateTimeOffset   indexed, for the janitor's sweep
  SharedByUserId  Guid?     FK -> Users.Id, nullable (anonymous sharer), first-writer-wins
  PayloadJson     string    jsonb; the full RecapPayloadDto
```

No denormalized listing columns — `GET /api/recaps/mine` deserializes `PayloadJson` server-side for
each row. Accepted simplicity at this project's expected volume; revisit only if it's ever a real
cost.

`RecapPayloadDto` (mirrored by hand into `contracts.ts`, same convention as every other DTO):
`RoomCode`, `FinishedAtUtc`, `RoundsPlayed`, `Language`, `MapViewBox`, `WinnerPlayerIds[]`,
`Players[]` (`PlayerId`, `DisplayName`, `AvatarId`, `IsBot`, `FinalScore`, `TerritoriesHeld`,
`LongestStreak`, `Eliminated`), `RegionOwnership[]` (`RegionId`, `OwnerPlayerId`), `Highlights[]` — a
tagged union of `BaseAssault{AttackerPlayerId,DefenderPlayerId,BaseRegionId,AttackerWon}`,
`GoldenQuestion{WinnerPlayerIds}`, `CategoryBansResolved{Categories}`.

## Risks / Trade-offs

- **[Risk]** Telegram's crawler may not rasterize an SVG `og:image` in every client version. →
  **Mitigation**: Telegram falls back to a text-only card (title + description) when the image
  fails, which still satisfies "informative"; upgrading to a rasterized PNG later (e.g. via
  SkiaSharp) is a same-endpoint swap with no schema change, since the image is always derived from
  `PayloadJson`, never stored.
- **[Risk]** Trusting the client's payload shape (Decision 1) means a modified client could post a
  cosmetically wrong recap (e.g. inflated highlight text). → **Mitigation**: bounded blast radius —
  a recap is display-only and never read back into any gameplay path; server-side validation still
  rejects structurally invalid payloads (unknown player ids, out-of-range numbers, oversized
  strings).
- **[Trade-off]** Fingerprint-based dedup (Decision 2) means an exact rematch collides. Accepted —
  see Decision 2.

## Migration Plan

Additive only: one new EF Core migration (`AddGameRecaps`) against the existing
`TriviadorDbContext`/`Postgres` connection, no changes to existing tables. New `Recap` appsettings
section with a safe default (`RetentionDays: 14`) — no `render.yaml`/dashboard changes are required
to deploy; the retention window can be tuned later purely via the `Recap__RetentionDays` env var.
