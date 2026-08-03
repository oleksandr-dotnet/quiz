## Purpose
Lets a player sign in with a persistent Google-backed account instead of a throwaway per-session
nickname, choosing a unique username and avatar once, so their identity and session are recognized
automatically on every later visit - while anonymous, no-account play remains fully available
alongside it.

## ADDED Requirements

### Requirement: Anonymous play remains fully available
A player SHALL be able to create or join a room without signing in, exactly as before this change:
typing a nickname and receiving a `playerToken` that survives a refresh. Signing in SHALL be an
entirely optional, additional path, never a requirement to play.

#### Scenario: A player plays without signing in
- **WHEN** a player creates or joins a room without using the "Sign in with Google" option
- **THEN** they play exactly as today, identified only by their typed nickname and session
  `playerToken`, with no account created and no data persisted for them

### Requirement: Google sign-in resolves to a persistent account by Google's stable subject id
The server SHALL identify a Google sign-in by the `sub` claim of a verified Google ID token, never by
email address. A first sign-in from a given Google subject id SHALL create a new account linked to
that subject id; every later sign-in from the same subject id SHALL resolve to that same account.

#### Scenario: First sign-in creates an account
- **WHEN** a player signs in with a Google account that has never signed in before
- **THEN** a new account is created and linked to that Google account's subject id

#### Scenario: Returning sign-in resolves to the same account
- **WHEN** a player signs in with a Google account that has signed in before
- **THEN** they are resolved to the same account created on their first sign-in, not a new one

#### Scenario: A changed Google email does not create a duplicate account
- **WHEN** a player signs in with a Google account whose email address has changed since their last
  sign-in, but whose underlying Google account is the same
- **THEN** they are still resolved to their existing account

### Requirement: A Google ID token is cryptographically verified before any account is created or resolved
The server SHALL reject a Google sign-in whose ID token fails signature verification against Google's
published keys, whose issuer is not Google, whose audience does not match this application's client
id, or whose token has expired. No account SHALL be created or resolved from an unverified token.

#### Scenario: A tampered or expired token is rejected
- **WHEN** a sign-in request presents a Google ID token that fails signature, issuer, audience, or
  expiry verification
- **THEN** the sign-in is rejected and no account is created or resolved

### Requirement: A newly-created account must set a unique username and an avatar before playing
An account created by a first Google sign-in SHALL be required to choose a username and an avatar
before it can create or join any room. The username SHALL be unique across all accounts, compared
case-insensitively. An account that has already completed this SHALL NOT be asked again.

#### Scenario: A new signed-in account must complete setup before playing
- **WHEN** a player signs in with Google for the first time
- **THEN** they are required to choose a username and an avatar before they can create or join a room

#### Scenario: A taken username is rejected
- **WHEN** a player attempts to set a username that another account already holds, regardless of
  letter case
- **THEN** the request is rejected and their account's username remains unset

#### Scenario: A returning fully-set-up account is not asked again
- **WHEN** a player signs in with an account that already has a username and avatar set
- **THEN** they proceed directly to creating or joining a room without a setup step

### Requirement: A signed-in session is silently restored on a later visit
Once signed in, a player SHALL NOT need to sign in again or re-enter any information on a later visit
within their session's validity period; their identity SHALL be restored automatically when they
return to the application.

#### Scenario: Returning later restores the session automatically
- **WHEN** a previously signed-in player returns to the application within their refresh token's
  validity period
- **THEN** they are automatically recognized as their existing account, with their username and avatar
  available, without any manual sign-in step

### Requirement: A signed-in account's username and avatar are what other players see
When an authenticated player creates or joins a room, the identity shown to every other player in that
room (seat list, roster, and everywhere else a display identity appears) SHALL be that account's
username and avatar, not freeform text supplied by the client.

#### Scenario: A signed-in player's account identity is displayed
- **WHEN** a signed-in player joins a room
- **THEN** every other player in the room sees that account's username and avatar as their identity

### Requirement: Refresh tokens are rotated on every use and revocable
Each use of a refresh token to obtain a new access token SHALL invalidate that refresh token and issue
a new one in its place. A refresh token that has already been invalidated SHALL NOT be usable again;
presenting one SHALL revoke every token descended from the same original sign-in, forcing a fresh
sign-in.

#### Scenario: A used refresh token cannot be reused
- **WHEN** a refresh token that has already been used to obtain a new one is presented again
- **THEN** the request is rejected and every token in that same chain is revoked, requiring a fresh
  sign-in

### Requirement: Signing out revokes the session
A signed-in player SHALL be able to sign out, which SHALL immediately revoke their refresh token so it
cannot be used to silently restore their session afterward.

#### Scenario: Signing out prevents silent restoration
- **WHEN** a player signs out and later returns to the application
- **THEN** they are not automatically recognized as their account and must sign in again
