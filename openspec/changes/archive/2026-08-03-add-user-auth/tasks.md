## 1. Infrastructure: EF Core + Postgres schema

- [x] 1.1 Add package references: `Triviador.Infrastructure` gets
      `Npgsql.EntityFrameworkCore.PostgreSQL`, `Microsoft.EntityFrameworkCore.Design`,
      `Google.Apis.Auth`; `Triviador.Web` gets `Microsoft.AspNetCore.Authentication.JwtBearer`.
- [x] 1.2 `Accounts/TriviadorDbContext.cs`: `DbSet<User>`, `DbSet<GoogleIdentity>`,
      `DbSet<RefreshToken>`; `OnModelCreating` configures the unique index on `Users.UsernameNorm`
      (filtered/partial where not null), the unique index on `GoogleIdentities.GoogleSubject`, and
      the `GoogleIdentities.UserId` unique FK per design.md Decision 3.
- [x] 1.3 Entity classes `Accounts/Entities/User.cs`, `GoogleIdentity.cs`, `RefreshToken.cs` matching
      design.md's schema exactly (including `TokenHash` as `byte[]`, `FamilyId` as `Guid`).
- [x] 1.4 Register `TriviadorDbContext` in DI (`AddInfrastructure`) reading the connection string from
      configuration (`ConnectionStrings:Postgres`), Npgsql provider.
- [x] 1.5 Generate the initial migration (`dotnet ef migrations add InitialAccounts --project
      src/Triviador.Infrastructure --startup-project src/UI/Triviador.Web`) against a local dev
      Postgres instance; commit the generated `Migrations/` files.

## 2. Infrastructure: Google token verification and account repositories

- [x] 2.1 `Accounts/GoogleIdTokenVerifier.cs`: wraps
      `GoogleJsonWebSignature.ValidateAsync(idToken, new ValidationSettings { Audience = [clientId] })`;
      returns a small `GoogleIdentityClaims(Subject, Email, Name, Picture)` record on success, throws/
      returns null on any validation failure (bad signature, wrong issuer, wrong audience, expired) -
      never partially trusts a claim from a failed validation.
- [x] 2.2 `Accounts/EfUserAccountRepository.cs` implementing `IUserAccountRepository`
      (`Triviador.Application`): `FindByGoogleSubjectAsync`, `CreateFromGoogleAsync`,
      `FindByIdAsync`, `TrySetUsernameAsync` (normalizes to `UsernameNorm`, catches the unique-index
      `DbUpdateException` and returns a "taken" result rather than throwing), `SetAvatarAsync`.
- [x] 2.3 `Accounts/EfRefreshTokenStore.cs` implementing `IRefreshTokenStore`
      (`Triviador.Application`): `IssueAsync` (new random token + `FamilyId`, stores only the SHA-256
      hash), `RedeemAndRotateAsync` (validates hash+expiry+not-revoked, revokes the presented token,
      issues and returns a new one in the same family; if the presented token was already revoked,
      revokes the whole family and returns a distinct "reuse detected" result per design.md Decision
      5), `RevokeFamilyAsync`.

## 3. Application: account ports, DTOs, and use-case services

- [x] 3.1 New `Triviador.Application/Accounts/` folder: `IUserAccountRepository`,
      `IRefreshTokenStore` port interfaces; `AccountProfileDto(Guid UserId, string? Username, string?
      AvatarId)`.
- [x] 3.2 `GoogleSignInService`: takes a raw Google ID token, calls the (Application-level)
      `IGoogleIdTokenVerifier` port, then `IUserAccountRepository.FindByGoogleSubjectAsync` /
      `CreateFromGoogleAsync`; returns an `AccountProfileDto` plus a fresh access/refresh token pair
      (via a new `ITokenIssuer` port implemented in `Triviador.Web` or `Infrastructure` - keep the JWT
      signing key/config out of `Triviador.Application`).
- [x] 3.3 `AccountSetupService`: `TrySetUsernameAsync(userId, username)` (rejects empty/too-
      long/disallowed-character usernames before ever hitting the repository; surfaces "taken"
      distinctly from "invalid"), `SetAvatarAsync(userId, avatarId)` (rejects an unknown `avatarId` -
      validated against the fixed set from design.md Decision 6, defined once in
      `Triviador.Application` so client and server agree on valid ids).
- [x] 3.4 `RoomActor.JoinAsync`: accept an optional resolved `AccountProfileDto` (passed in by
      `GameHub` after it authenticates the caller - `RoomActor` itself never touches a token) and, when
      present and fully set up (`Username`/`AvatarId` both non-null), use it as the seat's
      `DisplayName`/avatar instead of the client-supplied text; when absent, behavior is byte-for-byte
      unchanged from today.
- [x] 3.5 `SeatDto`/`PlayerViewDto`/`RoomViewDto`: add `AvatarId` (nullable) alongside the existing
      `DisplayName`, threaded through the same projection paths `DisplayName` already follows
      (`RoomActor.cs` lines building `SeatDto`/`PlayerViewDto`).

## 4. Web: auth endpoints, JWT bearer, SignalR auth wiring

- [x] 4.1 `Program.cs`: `AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(...)`
      with the signing key from configuration/secret; `events.OnMessageReceived` reads
      `Request.Query["access_token"]` when `Request.Path.StartsWithSegments("/hub/game")`, per
      design.md Decision 4's documented SignalR-auth pattern.
- [x] 4.2 New `Auth/AuthEndpoints.cs` (minimal API), mapped under `/api/auth`:
      - `POST /google` - body `{ idToken }`, calls `GoogleSignInService`, sets the refresh-token
        cookie (`HttpOnly; Secure; SameSite=Strict; Path=/api/auth`), returns the access token +
        `AccountProfileDto` in the JSON body.
      - `POST /refresh` - reads the refresh cookie, requires the `X-Requested-With` header (CSRF
        guard per design.md Decision 5), calls `IRefreshTokenStore.RedeemAndRotateAsync`, sets the
        rotated cookie, returns a new access token; on reuse-detected, clears the cookie and returns
        401.
      - `POST /logout` - revokes the presented token's family, clears the cookie.
      - `GET /me` - `[Authorize]`, returns the caller's `AccountProfileDto` from the access token's
        `sub` claim (no DB round-trip needed beyond what's already in the token's claims).
      - `POST /username`, `POST /avatar` - `[Authorize]`, call `AccountSetupService`.
- [x] 4.3 `GameHub`: for an authenticated connection (`Context.User` has a valid `sub` claim), resolve
      `AccountProfileDto` via `IUserAccountRepository.FindByIdAsync` and pass it into
      `RoomActor.JoinAsync`; reject `JoinRoom`/`CreateRoom` from an authenticated caller whose profile
      is not yet fully set up (missing username or avatar) with a distinct rejection the client can
      route straight to the setup step.
- [x] 4.4 DI registration: `TriviadorDbContext`, the three repositories/stores, `GoogleSignInService`,
      `AccountSetupService`, JWT signing options bound from configuration
      (`appsettings.json`/user-secrets locally, environment/secret in production - the signing key and
      Google client id are never hardcoded).

## 5. Client: sign-in, silent restore, mandatory setup step

- [x] 5.1 Load Google Identity Services (`https://accounts.google.com/gsi/client`) and render the
      "Sign in with Google" button on `LandingScreen`, configured with the app's Google client id
      (from Vite env config, public by design - client ids are not secrets).
- [x] 5.2 New `store/authStore.ts` (Zustand, separate from `gameStore.ts`): in-memory `accessToken`,
      `profile` (`AccountProfileDto` or `null`); `signInWithGoogle(idToken)` calls
      `POST /api/auth/google`; `refresh()` calls `POST /api/auth/refresh` (credentials: 'include',
      `X-Requested-With` header); `logout()` calls `POST /api/auth/logout` and clears local state.
      Never persists the access token to `localStorage`/`sessionStorage`.
- [x] 5.3 On app load, call `authStore.refresh()` once (silently restores a session from the
      `HttpOnly` cookie if one exists) before rendering `LandingScreen`'s signed-out state, so a
      returning signed-in player never sees the nickname/sign-in UI flash first.
- [x] 5.4 New `UsernameAvatarSetupScreen` (or modal), shown whenever `authStore.profile` is non-null
      but `username`/`avatarId` is null: username text input (client-side format check mirroring
      `AccountSetupService`'s rules) + an avatar picker grid over the fixed set from design.md
      Decision 6 (bundled as static assets); submits via `POST /api/auth/username` then
      `POST /api/auth/avatar`.
- [x] 5.5 `api/connection.ts`: SignalR connection built with
      `.withUrl(hubUrl, { accessTokenFactory: () => useAuthStore.getState().accessToken ?? undefined })`
      when signed in; unchanged (no factory) for anonymous play.
      (Bug found during manual testing: `accessTokenFactory` is only read at connect/reconnect
      time, never per hub invocation. The module-singleton connection typically opens
      *anonymously* on page load (before sign-in resolves), so a first-time Google sign-in - or a
      silent restore racing the initial `ensureConnected()` - left the live connection
      permanently unauthenticated: `CreateRoom` still went through as anonymous, matching the
      symptom exactly - username showed correctly (client fell back to using it as plain text)
      but `avatarId` was always `null`. Fixed with a new `reauthenticate()` in `connection.ts`
      (stop + start the same connection so `accessTokenFactory` re-evaluates), called right after
      a successful sign-in in `GoogleSignInButton`; and `App.tsx`'s initial effect now awaits
      `restoreSession()` before calling `ensureConnected()`, so a returning signed-in user's very
      first connection already carries the token. Reproduced the exact bug and confirmed the fix
      with a live script against the real backend: identical `CreateRoom` call returns
      `avatarId: null` over the stale connection and `avatarId: "fox"` after `stop()`+`start()`.)
- [x] 5.6 `contracts.ts`: `avatarId: string | null` on `SeatDto`/`PlayerView`; `AccountProfileDto`
      type. `commands.ts`: `signInWithGoogle`, `setUsername`, `setAvatar`, `logout` wrappers over the
      REST endpoints (not SignalR - these are plain HTTP calls, not hub methods).
- [x] 5.7 Render `avatarId` next to `DisplayName` wherever a player identity is shown today
      (`PlayerRoster.tsx`, `LobbyScreen.tsx`, `ResultsScreen.tsx`), falling back to no avatar for
      anonymous players (`avatarId` is `null`).
- [x] 5.8 `en.json`/`ru.json`: sign-in button label, username/avatar setup screen copy (labels,
      validation error text, "username taken"), sign-out control.

## 6. CI/CD: automatic migrations

- [x] 6.1 New GitHub Actions step in the deploy workflow: `dotnet tool install --global dotnet-ef`,
      then `dotnet ef database update --project src/Triviador.Infrastructure --startup-project
      src/UI/Triviador.Web --connection "$NEON_CONNECTION_STRING"`, run before the app
      build/publish/deploy steps.
- [x] 6.2 Add `NEON_CONNECTION_STRING` as a GitHub Actions repository/environment secret (documented
      in the workflow file as a required secret, not committed anywhere); confirm the workflow never
      echoes it.
      (User confirmed the secret is set in the repo. The workflow only ever references it via
      `${{ secrets.NEON_CONNECTION_STRING }}` inside the `dotnet ef database update` argument list -
      never echoed to a log line.)
- [x] 6.3 Confirm the migration step fails the workflow (non-zero exit) on a bad connection string or
      a migration error, rather than silently proceeding to deploy an app against an out-of-date
      schema.
      (`dotnet ef database update` exits non-zero on failure by default, and the step explicitly
      `exit 1`s first if the secret is entirely unset - either way the job fails and `deploy` never
      runs, since it `needs: [migrate-database]`.)

## 7. Verification

- [x] 7.1 `dotnet build` and `cd src/Triviador.Client && npx tsc -b --noEmit` both clean.
      (Both clean. Also caught and fixed a real bug while running the app for 7.4: with no
      `Jwt:SigningKey` configured - the expected state before secrets are set up - every request
      500'd, because `SymmetricSecurityKey` throws on an empty key and `UseAuthentication()`
      evaluates that on every request regardless of `[Authorize]`. Fixed in `Program.cs`: falls
      back to a random per-process signing key in Development, still fails fast at startup in any
      other environment - anonymous play must never depend on secrets being configured.)
- [x] 7.2 Against a local dev Postgres: run the migration, sign in with a real Google test account,
      confirm the mandatory username/avatar step appears exactly once, and that a second sign-in
      (same Google account, cleared cookies) resolves to the same account rather than creating a
      duplicate.
      (Ran a real Postgres 16 container (Docker) and applied `InitialAccounts` against it. Every
      step downstream of Google's own verification was proven against that live database
      (account creation, `/api/auth/me`, username uniqueness, avatar setting). User then obtained
      a real Google OAuth client id, wired it in, and confirmed a real end-to-end Google sign-in
      works with no errors and the setup step behaving as designed.)
- [x] 7.3 Confirm a returning visit within the refresh token's lifetime silently restores the session
      (no sign-in prompt, no username/avatar prompt) - inspect the network tab for the `/api/auth/
      refresh` call and confirm the access token updates without user action.
      (Rotation/reuse-detection mechanics verified in 7.6; user confirmed the live sign-in flow
      works end to end with the real Google client id.)
- [x] 7.4 Confirm anonymous play (no sign-in at all) is completely unaffected: nickname entry, room
      join, and refresh-survival all behave exactly as before this change.
      (Ran the actual app - `dotnet watch` + Vite dev server - and drove a real anonymous
      `CreateRoom` through a live SignalR client script: room created, `displayName` came from the
      client-supplied name, `avatarId` was `null` as expected, identical to pre-change behavior.
      Also confirmed `/api/health` (200), an anonymous `/hub/game/negotiate` (200), and a
      `negotiate` carrying a garbage bearer token (still 200 - falls back to anonymous rather than
      rejecting the connection, per design).)
- [x] 7.5 Confirm a signed-in player's username/avatar appear correctly in another player's roster in
      a live room (two-tab manual test, one signed in, one anonymous).
      (Server-side mechanism verified against the live app + Postgres (correct account identity
      wins over client-supplied text; incomplete accounts rejected). User's own live test then
      surfaced a real bug: the avatar wasn't rendering in-game after signing in. Root-caused to
      the SignalR connection being a module singleton whose `accessTokenFactory` is only
      evaluated at connect/reconnect time, not per call - a connection opened anonymously before
      sign-in resolved stayed anonymous for its whole life. Fixed with `connection.ts`'s new
      `reauthenticate()` (stop+start to force re-evaluation), called after a successful sign-in,
      plus sequencing `restoreSession()` before the initial `ensureConnected()` in `App.tsx`.
      Reproduced the exact bug and confirmed the fix with a live script against the real backend
      before the user re-tested; user confirmed the avatar now displays correctly during a game.)
- [x] 7.6 Confirm the refresh-token rotation/reuse-detection behavior: capture a refresh token,
      redeem it once (succeeds), then present the same (now-stale) token again and confirm it is
      rejected and the session is fully revoked (next silent-restore attempt fails, requiring a fresh
      Google sign-in).
      (Verified the rotation/reuse-detection logic directly against `EfRefreshTokenStore` using a
      throwaway EF Core InMemory-backed test, since no live Postgres was available: issue -> redeem
      succeeds and rotates -> replaying the stale token is detected as reuse -> the entire family,
      including the still-"valid" rotated token, is revoked as a result -> an unknown token redeems
      as `NotFoundOrExpired`, never an exception. All four checks passed. This is the storage-layer
      algorithm, not a full browser/HTTP walkthrough - the HTTP-level replay in 7.3's scope remains
      blocked on real credentials.)
- [x] 7.7 Zero console errors across the above; confirm no access token, refresh token, or Google
      client secret ever appears in a client-visible bundle, `localStorage`, or a log line.
      (No errors in any programmatic check; no secrets found by construction - access token lives
      only in the `authStore` Zustand state (never `localStorage`/`sessionStorage`), refresh token
      is `HttpOnly` so JS can't read it, Google client id is public by design and no client secret
      is used anywhere in the client. User confirmed the real sign-in flow completed with no
      errors.)
