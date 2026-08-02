## Why

`useGameTransitions` explicitly documents that a single snapshot can encode several transitions at
once (e.g. a base assault's final hit produces `baseDamaged` *and* `baseCaptured` *and*
`playerEliminated` together) and that callers "should play them in the order returned, not assume at
most one transition per snapshot." The consuming effect in `App.tsx` violates that contract: it
picks the highest-priority match with `.find()` and returns immediately, so only one proclamation
ever shows per snapshot batch - every other significant event in that same batch (most commonly: the
base-falls proclamation getting silently dropped in favor of the own-elimination one, in exactly the
"final hit" scenario the transitions hook's own comment calls out) is lost entirely, with no queued
follow-up. This is a real, doc-acknowledged bug, not a hypothetical one - and it got slightly worse
when this session's `own-elimination-notice` change added a third mutually-exclusive branch ahead of
the existing `baseCaptured` one.

## What Changes

- Replace the single `proclamation` state's "pick one, drop the rest" resolution with a queue: every
  proclamation-worthy transition in a batch is enqueued (in the existing priority order), and a
  separate effect drains the queue one message at a time, each shown for the same 4s window as
  today.
- Decouple the map-shake (`baseDamaged`) effect from the proclamation priority chain entirely, so it
  fires whenever `baseDamaged` is present in a batch regardless of whether a proclamation also fires
  from that same batch (today it's skipped whenever a higher-priority proclamation branch already
  matched).
- Incidental cleanup: remove the unused `reveal.correctTitle` locale key (a leftover from a rename;
  `RevealOverlay` uses `reveal.correctAnswerLabel` instead).
- No change to game logic, rules, DTOs, or server/domain code - client-only presentation fix.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `client-presentation`: strengthens the existing "every state change gets visible feedback"
  requirement so that multiple significant transitions landing in the same snapshot each still get
  shown, not just the highest-priority one.

## Impact

- Affected code: `src/Triviador.Client/src/App.tsx` only, plus deleting one unused locale key. No
  server, domain, or DTO changes, no new dependencies.
