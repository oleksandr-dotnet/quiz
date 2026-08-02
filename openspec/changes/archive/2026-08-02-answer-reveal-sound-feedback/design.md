## Context

The client currently has zero audio. `RevealOverlay` already computes, per row, whether each
player's answer was `correct` (comparing `answerText` against the correct answer's text) - the
viewer's own row is just one more entry in that same `ranked` array, keyed by `view.youPlayerId`.

## Goals / Non-Goals

**Goals:**
- Give the viewer an audible correct/incorrect cue at the exact moment a question resolves.
- Add zero new dependencies and zero new network requests (no audio asset files to fetch/host).
- Respect a mute preference that survives reloads.

**Non-Goals:**
- A full sound-design pass (capture sounds, timer ticks, victory fanfare, ambient music). This
  change is scoped to the single highest-value moment: the answer reveal.
- Volume sliders or per-cue-type mute toggles - one global mute switch is enough for this scope.

## Decisions

**Synthesize tones with the Web Audio API instead of shipping audio files.** Alternatives
considered: bundling short `.mp3`/`.wav` assets. Rejected because it adds binary assets to the repo
and an extra network request per sound on first play, for a cue simple enough that a couple of
`OscillatorNode`s produce a perfectly serviceable chime/buzz. `AudioContext.createOscillator` plus a
`GainNode` envelope (attack at full gain, exponential ramp to near-zero) is enough for a pleasant,
non-jarring cue without needing any audio editing tooling.

**Lazily create/resume a single module-level `AudioContext`.** Browsers block audio output until a
page has received a user gesture. Rather than trying to "warm up" the context on mount (which may
run before any gesture), each play call itself lazily constructs the context on first use and calls
`.resume()` if suspended - by the time any reveal fires, the player has already clicked at least one
button (an answer option, a keypad digit, a region) in the current session, so the gesture
requirement is already satisfied in every real play path.

**Play once per question, not once per render.** `RevealOverlay` can re-render while a reveal is
visible (e.g. `secondsRemaining` ticking down in battle's `RevealHold`). Firing the cue from a
`useEffect` keyed on `prompt.questionId` (not on every render) guarantees exactly one play per
resolved question.

## Risks / Trade-offs

- **Autoplay policy could still block the very first sound in an unusual flow** (e.g. a spectator
  who never clicks anything before the first reveal). Mitigation: the play call still attempts
  `.resume()` and silently no-ops if the browser refuses it - no error surfaces, no broken UI, the
  player just doesn't hear that one cue.
- **A generic synthesized tone is not going to sound as polished as a produced audio file.**
  Accepted for this scope; a future change can swap in real assets without touching the
  correct/incorrect-detection or mute-persistence logic.
