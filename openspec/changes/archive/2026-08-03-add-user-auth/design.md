## Context

See proposal.md - Why. Today identity is entirely transient: `LandingScreen` collects a nickname,
`RoomActor.JoinAsync(displayName, playerToken, connectionId)` seats the player, and reconnection
across a refresh works only because the client echoes back the `playerToken` it got on first join
(`room-lobby`'s "Player identity survives a page refresh"). There is no server-side notion of "this
browser/person is the same one who played yesterday." `Triviador.Domain` and `Triviador.Application`
have zero dependencies today beyond each other and the Domain's zero-package rule
(`BannedSymbols.txt` blocks ambient time/randomness); no project currently touches a database, HTTP
auth, or an external identity provider. This is new ground for the solution, not an extension of an
existing pattern - the decisions below establish that pattern for the first time.

## Goals / Non-Goals

**Goals:**
- Let a player sign in with Google once and be silently recognized on every later visit - no
  re-entering a nickname, ever - via a persisted account.
- Enforce a unique, server-validated username and a chosen avatar before a signed-in account can
  play, without touching the anonymous flow at all.
- Persist accounts in Postgres (Neon in production) via EF Core, with migrations applied
  automatically in CI/CD, never by hand against production.
- Use current best-practice token handling: short-lived access tokens, rotated refresh tokens, no
  long-lived secrets reachable by JavaScript that doesn't need them.
- Keep the Domain/Application/Infrastructure boundary from `CLAUDE.md` intact: no game rule anywhere
  learns about accounts, OAuth, or SQL.

**Non-Goals:**
- Other OAuth providers (GitHub, Discord, etc.) - Google only for this change; the port design
  (Decision 2) doesn't preclude adding more later, but nothing else is wired up now.
- Linking multiple sign-in methods to one account, or converting an existing anonymous session's
  in-progress room into an authenticated one - signing in is a landing-screen action, not something
  that happens mid-room.
- Arbitrary user-uploaded avatar images - see Decision 6.
- Account features beyond identity: no friends list, stats, profile pages, or email/password login.
- Any change to `Triviador.Domain` - see Decision 1.

## Decisions

**1. Accounts live entirely in Application/Infrastructure; Domain is untouched.** `GameEngine` already
addresses every player by an opaque `PlayerId` and never needed to know who's behind it. Accounts are
an identity/presentation concern the same way `DisplayName` already is - a signed-in caller's
`AccountId` resolves to a `DisplayName`/avatar *before* anything reaches the engine, exactly like an
anonymous nickname does today. *Alternative considered:* teach `PlayerState` about `AccountId` -
rejected, it would make every replay/fingerprint calculation depend on account data that has nothing
to do with game rules, and violates "nothing outside Domain/Application knows the rules" the other
way around (Domain would start knowing about accounts).

**2. Google sign-in verifies an ID token from Google Identity Services (GIS), not a server-side
Authorization Code + PKCE exchange.** The client loads Google's GIS script, renders the "Sign in with
Google" button, and receives a Google-issued ID token (a signed JWT) directly in the browser with no
client secret involved. The client POSTs that token to `POST /api/auth/google`; the server validates
it with `Google.Apis.Auth.GoogleJsonWebSignature.ValidateAsync` (checks signature against Google's
published JWKs, `iss`, `aud` against our client id, and `exp`) and reads `sub`/`email`/`name`/`picture`
from the validated payload. *Alternative considered:* full Authorization Code + PKCE redirect flow -
rejected for this use case because we only ever need to *identify* the player (their Google subject
id, email, name, picture), never to call a Google API on their behalf; PKCE/state/nonce exist to
protect an authorization grant that hands out access to a resource, which we don't need. GIS's token
flow is Google's own recommended pattern for "sign in, don't authorize" SPAs and is not weaker for this
purpose - the server-side signature/issuer/audience/expiry check is the actual trust boundary either
way. *Security note:* this is the one place `PKCE`/`state`/`nonce` as literally named in the proposal's
original ask don't apply 1:1; the equivalent protections here are token signature verification,
audience pinning to our client id, and short validity window enforcement, all performed server-side
before any account is created or resolved.

**3. New EF Core schema, `Triviador.Infrastructure`, Npgsql provider:**
```
Users
  Id            uuid PK
  Username      text, nullable until set
  UsernameNorm  text, nullable, unique index (lower-invariant of Username) - the actual uniqueness
                guard; Username itself keeps the player's chosen casing
  AvatarId      text, nullable until set (see Decision 6)
  CreatedAtUtc  timestamptz

GoogleIdentities
  Id            uuid PK
  UserId        uuid FK -> Users, unique (one Google identity per user in this change)
  GoogleSubject text, unique index - Google's stable `sub` claim, the actual link key
  Email         text - latest known value, display/debug only, never used as the link key
  LinkedAtUtc   timestamptz

RefreshTokens
  Id            uuid PK
  UserId        uuid FK -> Users
  TokenHash     bytea - SHA-256 of the opaque token value; the raw value is never stored
  FamilyId      uuid - shared by a token and everything it's rotated into (Decision 5)
  ExpiresAtUtc  timestamptz
  RevokedAtUtc  timestamptz, nullable
  CreatedAtUtc  timestamptz
```
`GoogleSubject` (not `Email`) is the link key because Google's own guidance is that `sub` is stable
and `email` can change or be reused; keying on it means a user who changes their Google account email
still resolves to the same `User`. *Alternative considered:* a generic `ExternalLogins` table with a
`Provider` discriminator column, anticipating more providers later - rejected as speculative given the
Non-Goals above; `GoogleIdentities` is one `git mv`/rename away from that shape whenever a second
provider is actually added, per this project's "no half-finished implementations" and "don't design
for hypothetical future requirements" conventions.

**4. Access token: short-lived JWT, held only in client memory.** 15-minute expiry, signed with a
server-held symmetric key (`Microsoft.AspNetCore.Authentication.JwtBearer`), claims limited to
`sub` (our `UserId`), `username`, `avatar`, `exp`. The client keeps it in the Zustand auth store only
(never `localStorage`/`sessionStorage`) - lost on a hard refresh by design, immediately replaced by a
silent call to `/api/auth/refresh` on load. It is attached to the SignalR connection via
`HubConnectionBuilder.withUrl(url, { accessTokenFactory: () => token })`, which SignalR forwards as
the bearer token on both the initial negotiate call and the WebSocket upgrade; `Program.cs` wires
`JwtBearerEvents.OnMessageReceived` to also accept it from the `access_token` query string specifically
on the hub's path, matching the documented ASP.NET Core SignalR-auth pattern (WebSockets can't set an
`Authorization` header).

**5. Refresh token: opaque random value, rotated on every use, revocable by family.** Issued as 32
random bytes (base64url), returned to the client solely via `Set-Cookie` with `HttpOnly; Secure;
SameSite=Strict; Path=/api/auth/refresh`, 30-day sliding expiry. Only its SHA-256 hash is ever stored
(`RefreshTokens.TokenHash`) - a stolen database dump reveals no usable tokens. Every successful
`/api/auth/refresh` call revokes the presented token and issues a new one in the same `FamilyId`; if a
*revoked* token is ever presented again (a stolen/replayed copy used after the legitimate client
already rotated past it), the entire family is revoked and the caller is forced back to a fresh Google
sign-in - the standard rotation-with-reuse-detection pattern, which turns "refresh token stolen" from
a silent, permanent compromise into a detectable, bounded one. `/api/auth/logout` revokes the
presented family outright. **CSRF:** the refresh/logout endpoints only ever receive a `SameSite=Strict`
cookie sent by same-site requests, and require a custom header the client sets on every call
(`X-Requested-With`), which a cross-site form/navigation cannot attach - together these remove the
attack surface a `SameSite=Strict` cookie already mostly closes, without needing a separate
double-submit CSRF token.

**6. Avatar is chosen from a fixed in-app set, not uploaded.** `AvatarId` is a small string key into a
curated set of avatar images already bundled into `Triviador.Client`'s assets (same treatment as the
map's static art); the account setup step is a picker grid, not a file input. *Alternative considered:*
let the user upload an arbitrary image, or default to Google's `picture` URL - rejected: an upload
needs storage (Neon has none for blobs), a CDN, image-parsing/size/content-type validation, and moderation
concerns, none of which are in scope; hot-linking Google's `picture` URL means a third-party image
loads on every game screen and breaks if the user changes/removes their Google photo. A fixed set is
zero-infrastructure, always available, and trivially themeable to the game's own art style later.

**7. `Triviador.Application` gains an `Accounts/` area with its own ports, parallel to `Hosting/`, not
folded into `RoomActor`.** `IUserAccountRepository` (find-by-google-subject, create, find-by-id,
set-username-if-unique, set-avatar) and `IRefreshTokenStore` (issue, redeem-and-rotate, revoke-family)
are the ports; `Triviador.Infrastructure` implements them against `TriviadorDbContext`. `RoomActor`
depends on `IUserAccountRepository` only to resolve an already-authenticated caller's
`AccountProfileDto` (`Username`, `AvatarId`) into the `DisplayName`/avatar it seats - it never sees a
token, a password, or SQL. *Alternative considered:* put account logic directly in `GameHub`/
`Triviador.Web` since it's "just auth plumbing" - rejected, it's use-case orchestration (verify token,
resolve or create a user, enforce the username-set-before-play rule) exactly like `RoomActor`'s job is
use-case orchestration for rooms; `Triviador.Web` should stay narrowed to host/presentation concerns
per `CLAUDE.md`, calling into Application the same way `GameHub` already calls into `RoomActor`.

**8. Migrations are generated at dev time and checked in; CI/CD applies them, nothing applies them by
hand.** `dotnet ef migrations add <Name>` is run locally against a dev Postgres instance and the
generated `Migrations/` files are committed. A new GitHub Actions job (deploy workflow) runs
`dotnet ef database update --project src/Triviador.Infrastructure --connection "$NEON_CONNECTION_STRING"`
(connection string from a repository/environment secret) as a step before the app itself is
deployed/restarted. *Alternative considered:* run migrations on app startup
(`db.Database.MigrateAsync()` in `Program.cs`) - rejected as the sole mechanism because it means a
schema change ships silently on every deploy with no CI log to review beforehand and no way to gate a
risky migration separately from a code deploy; CI-driven migration keeps the "what changed in the
schema" step visible and independently retriable in the pipeline. *Alternative considered:* the
`dotnet-ef` global tool not being present in a bare CI runner - mitigated by installing it
(`dotnet tool install --global dotnet-ef`) as a workflow step; the runner already has the .NET SDK for
the existing build, so this adds one line, not a new toolchain.

**9. Username uniqueness is enforced at the database first, application second.** The unique index on
`UsernameNorm` is the actual guard against a race (two signed-in users claiming the same name in the
same instant); the application-level check-then-write is a fast path for the common case, and a
`DbUpdateException` from the unique-index violation on the rare race is caught and surfaced as the same
"username taken" rejection the fast path would have given, never a 500.

## Risks / Trade-offs

- [GIS token flow is less familiar than a redirect-based OAuth flow to engineers used to the latter] ->
  Mitigation: Decision 2 documents exactly why it's equivalent for an identity-only use case; the
  server-side validation step is identical in spirit (verify signature/issuer/audience/expiry before
  trusting any claim).
- [A stolen access token is valid for up to 15 minutes with no server-side revocation] -> Mitigation:
  this is the accepted trade-off of short-lived stateless JWTs; 15 minutes bounds the blast radius, and
  the refresh token (the actually-sensitive, long-lived credential) is fully revocable per Decision 5.
- [Fixed avatar set is less flexible than user uploads] -> Mitigation: explicitly scoped as a
  deliberate v1 simplification in Decision 6; nothing in the schema (`AvatarId` is just a string)
  blocks swapping in upload-backed URLs later without a migration.
- [CI now needs a live-reachable Postgres (Neon) connection string as a secret] -> Mitigation: standard
  GitHub Actions encrypted secret, scoped to the deploy environment; never printed in logs, never in
  client-reachable config.

## Migration Plan

1. Add `Npgsql.EntityFrameworkCore.PostgreSQL` and `Microsoft.AspNetCore.Authentication.JwtBearer` /
   `Google.Apis.Auth` package references to `Triviador.Infrastructure`; scaffold `TriviadorDbContext`
   and the three tables from Decision 3; generate the initial migration against a local dev Postgres.
2. Add the `Accounts/` ports (`IUserAccountRepository`, `IRefreshTokenStore`) and DTOs to
   `Triviador.Application`; implement them in `Triviador.Infrastructure`.
3. Add `/api/auth/google`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me` minimal-API
   endpoints and JWT bearer wiring (including the SignalR query-string accept path) to
   `src/UI/Triviador.Web`; DI registration for the `DbContext` and repositories.
4. Wire `RoomActor.JoinAsync` to resolve an authenticated caller's profile via
   `IUserAccountRepository` instead of trusting the client-supplied `displayName` when a valid access
   token is present; unauthenticated joins are completely unaffected.
5. Client: GIS script/button on `LandingScreen`, auth store (in-memory access token, silent refresh on
   load), the mandatory username/avatar-picker step for a first-time signed-in account, SignalR
   `accessTokenFactory` wiring.
6. Add the GitHub Actions migration step (Decision 8) to the deploy workflow, backed by a
   `NEON_CONNECTION_STRING` repository secret.
7. Verify end to end: fresh Google sign-in forces username/avatar setup once; a second sign-in with the
   same Google account on a new session (cookies cleared but a fresh login) resolves to the same
   account; a returning visit within the refresh token's lifetime silently restores the session with no
   prompt; anonymous play is fully unaffected throughout.

**Rollback:** the new tables/columns are strictly additive (no existing table is altered) and nothing
in `Triviador.Domain` or the anonymous flow changes, so reverting the commit and rolling back the
migration (`dotnet ef database update <PreviousMigration>`) leaves the anonymous game exactly as it is
today, with no data loss for anonymous play (which never persisted anything to begin with).

## Open Questions

- Whether a returning signed-in player should be auto-seated with their last-used display identity
  into a room they still hold a live `playerToken` for, versus always going through the landing
  screen's Google button - not addressed here; this change only covers the landing-screen entry point,
  consistent with the Non-Goals (no mid-room identity transitions).
- Google OAuth client id/secret provisioning (Google Cloud Console project setup) is an operational
  step outside this repo and isn't specified further here - `tasks.md` calls out where the resulting
  client id needs to land (client config + server validation audience), not how to obtain it.
