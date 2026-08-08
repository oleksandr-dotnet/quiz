## ADDED Requirements

### Requirement: A recap is persisted only when a player explicitly shares it
The server SHALL NOT persist any record of a finished game unless a player in that game submits a
share request for it.

#### Scenario: A game nobody shares leaves no recap
- **WHEN** a game reaches its finished state and every player simply leaves without using the share
  action
- **THEN** no `GameRecap` row exists for that game and no link is ever reachable for it

#### Scenario: A single share creates exactly one recap
- **WHEN** one player in a finished game uses the share action
- **THEN** a `GameRecap` row is created and a permanent link is returned

### Requirement: Multiple sharers of the same finished game resolve to the same link
The server SHALL deduplicate share requests for the same finished game so every sharer receives the
same permanent id, rather than creating a separate recap per sharer.

#### Scenario: A second player shares the same match
- **WHEN** a second player in the same finished game also uses the share action, after a first
  player already shared it
- **THEN** the second share request resolves to the same recap id the first one created

### Requirement: A shared recap is reachable by a permanent link for a configurable retention window
The server SHALL serve a shared recap at a stable `/recap/{id}` link until a configurable retention
period elapses, after which it is deleted and the link stops resolving.

#### Scenario: A recap is reachable shortly after sharing
- **WHEN** a recap has just been shared
- **THEN** `/recap/{id}` and `GET /api/recaps/{id}` both return its content

#### Scenario: A recap is gone after its retention window
- **WHEN** a recap's age exceeds the configured retention window and the cleanup sweep has run
- **THEN** `/recap/{id}` and `GET /api/recaps/{id}` no longer return its content

#### Scenario: Retention is configurable without a code change
- **WHEN** the operator changes the retention configuration value
- **THEN** newly created recaps use the new retention window; already-persisted recaps keep the
  expiry computed at their own creation time

### Requirement: A recap link renders an informative preview in link-unfurling clients
`GET /recap/{id}` SHALL return a document carrying `og:title`, `og:description`, and `og:image`
metadata describing the match, without requiring JavaScript execution to populate them.

#### Scenario: A crawler fetches the shell
- **WHEN** a link-preview crawler requests `/recap/{id}` for a valid, unexpired recap
- **THEN** the response's `<head>` contains `og:title`/`og:description`/`og:image` tags summarizing
  that match

#### Scenario: A human visits the same link
- **WHEN** a browser navigates to `/recap/{id}`
- **THEN** the full recap page renders identically to any other client-side route in the app

#### Scenario: An unknown or expired id degrades gracefully
- **WHEN** `/recap/{id}` is requested for an id that does not exist or has expired
- **THEN** the server returns the plain application shell (not an error page), and the client
  renders a not-found state

### Requirement: A signed-in user can list the recaps they've shared
`GET /api/recaps/mine` SHALL require authentication and return only recaps the signed-in user has
shared.

#### Scenario: A signed-in sharer sees their recap listed
- **WHEN** a signed-in user has previously shared at least one recap
- **THEN** their recap list includes it

#### Scenario: An anonymous share is not attributed to any account
- **WHEN** a player who is not signed in shares a recap
- **THEN** that recap is reachable by its link but does not appear in any user's recap list

### Requirement: A posted recap payload is structurally validated before persistence
The server SHALL reject a share request whose payload is not internally consistent (unknown player
ids referenced by a highlight, out-of-range numeric fields, oversized text fields) without
persisting it.

#### Scenario: A malformed payload is rejected
- **WHEN** a share request's payload references a player id not present in its own player list
- **THEN** the server rejects the request and no row is created
