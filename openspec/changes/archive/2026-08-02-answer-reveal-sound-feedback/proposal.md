## Why

The client has no audio feedback anywhere - every trivia reveal, the single moment a player learns
whether they were right, lands in total silence. Casual trivia/quiz games (Kahoot and similar) treat
a correct/incorrect chime at the reveal moment as baseline feedback, not decoration: it reinforces
the outcome the instant it happens, without the player having to read the ranked list. This is a
real, currently-total gap, not a nice-to-have.

## What Changes

- Add a small synthesized sound module (Web Audio API oscillators - no audio asset files, no new
  dependency) exposing a short ascending chime for "you answered correctly" and a short descending
  buzz for "you answered incorrectly."
- Play the appropriate cue once per resolved question, based on the viewer's own answer, when
  `RevealOverlay` mounts for that question. No sound when the viewer submitted no answer.
- Add a mute toggle in the in-game top bar; the preference persists (`localStorage`) across
  sessions and defaults to unmuted.
- No change to game logic, rules, DTOs, or server/domain code - client-only presentation addition.

## Capabilities

### New Capabilities
- `client-audio-feedback`: The client's obligation to give the viewer an audible correct/incorrect
  cue at each answer reveal, mutable and persisted.

### Modified Capabilities
(none)

## Impact

- Affected code: `src/Triviador.Client/src` only - a new sound module, a new mute-toggle component,
  wiring into `RevealOverlay.tsx` and the top bar, and new locale entries. No server, domain, or DTO
  changes, no new npm dependencies (Web Audio API is a browser built-in).
