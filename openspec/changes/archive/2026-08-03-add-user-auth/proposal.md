## Why

Every player today is anonymous and ephemeral: a nickname typed into `LandingScreen` plus a
`playerToken` in `sessionStorage` that only survives a refresh of the same tab (`room-lobby`'s
"Player identity survives a page refresh"). There is no way to come back later and be recognized,
no persisted display identity, and no account for a player to attach preferences to in the future.
Players who want a stable identity across sessions/devices - and a face (avatar) other players
recognize them by - have no path to get one. This change adds an optional persistent account, backed
by Google sign-in, alongside the anonymous flow, which is not removed.

## What Changes

- Anonymous play is unchanged: no account, no login, type a nickname, get a `playerToken` in
  `sessionStorage`, exactly as today.
- New "Sign in with Google" option on the landing screen. The client obtains a Google ID token via
  Google Identity Services and posts it to a new `/api/auth/google` endpoint; the server verifies it
  (signature, issuer, audience, expiry) against Google's public keys - it never sees or handles a
  Google password.
- First-time Google sign-in creates a `User` row linked to the Google account's stable subject id;
  subsequent sign-ins with the same Google account resolve to that same `User`, never create a
  duplicate.
- A `User` created this way has no username yet and MUST set one - unique across all accounts,
  case-insensitively - plus pick an avatar before they can create or join a room. Returning users who
  already completed this go straight into the game, and the login is silently restored on a later
  visit (no re-entering anything) via a persistent, rotating refresh token - the core ask of this
  change.
- Once signed in, the account's username and avatar are what other players see in the room roster and
  everywhere else a player's identity is shown today (`SeatDto.DisplayName`, `PlayerViewDto`), instead
  of freeform nickname text. Anonymous players are unaffected and keep showing their typed nickname.
- User accounts, Google identity links, and refresh tokens are persisted in Postgres via EF Core
  (Npgsql provider), Neon Postgres in production. EF Core migrations are generated at dev time,
  checked into the repo, and applied automatically as part of the GitHub Actions CI/CD pipeline before
  each deploy - never applied by hand against production.
- Modern token handling: short-lived signed access token (JWT) for API/SignalR calls, held only in
  memory on the client (never `localStorage`); a long-lived opaque refresh token, rotated on every use
  and stored server-side only as a salted hash, delivered to the client solely as an `HttpOnly`,
  `Secure`, `SameSite=Strict` cookie scoped to the refresh endpoint's path.

## Capabilities

### New Capabilities
- `player-accounts`: Google sign-in, first-login username/avatar setup with uniqueness, persistent
  cross-session identity, and the account/token security model (verification, rotation, revocation).

### Modified Capabilities
(none - `room-lobby`'s existing requirements never assert where `DisplayName` text comes from, so
`player-accounts`'s own requirement that a signed-in account's username/avatar is what's displayed
is additive; no `room-lobby` requirement text changes, and every anonymous-flow requirement in it is
unaffected)

## Impact

- `Triviador.Domain`: none. Accounts are an identity/presentation concern, not a game rule - the
  engine keeps addressing players by the same opaque `PlayerId` it always has.
- `Triviador.Infrastructure`: new `TriviadorDbContext` (EF Core, Npgsql) with `Users`,
  `GoogleIdentities`, and `RefreshTokens` tables and migrations; `GoogleIdTokenVerifier`;
  `EfUserAccountRepository` implementing a new Application-level port.
- `Triviador.Application`: new `Accounts/` area - `IUserAccountRepository`/`IRefreshTokenStore` ports,
  `AccountProfileDto`, use-case services for Google sign-in, username/avatar claim, token refresh, and
  logout/revocation; `RoomActor.JoinAsync` resolves an authenticated caller's `DisplayName`/avatar from
  the account service instead of trusting client-supplied text when a valid access token is present.
- `src/UI/Triviador.Web`: JWT bearer authentication wired for both minimal-API auth endpoints
  (`/api/auth/google`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`) and the SignalR hub
  (bearer token pulled from the connection query string on the hub path); DI registration for
  Infrastructure's EF Core context and repositories.
- `src/Triviador.Client`: Google Identity Services script/button on `LandingScreen`; an auth store
  (access token in memory, silent refresh on load); a mandatory "choose username & avatar" step for a
  first-time signed-in account; `contracts.ts`/`commands.ts` additions.
- CI/CD: a new GitHub Actions step applies pending EF Core migrations against the Neon Postgres
  connection string (from a repository secret) as part of the deploy pipeline.
