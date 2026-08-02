## Context

`App.tsx` derives `transitions` from `useGameTransitions(gameView, previousGameView)` every time a
new snapshot arrives, then reacts to them in one `useEffect`. That hook's own doc comment: "one
snapshot can encode several of these at once... callers that stagger these into set-pieces should
play them in the order returned, not assume at most one transition per snapshot" - a contract the
current effect does not honor: it uses `.find()` to pick the single highest-priority match
(`playerEliminated` for the viewer, then `baseCaptured`, then `baseDamaged`) and returns immediately
on the first match, so anything after it in that same batch is dropped forever.

## Goals / Non-Goals

**Goals:**
- Every proclamation-worthy transition in a batch eventually gets shown, not just the first match.
- The map-shake (`baseDamaged`) feedback fires independent of whether a proclamation also fires.
- Keep the existing 4s-per-proclamation display window and priority order (elimination first, then
  base-falls) - this only fixes what happens when *more than one* fires from the same batch.

**Non-Goals:**
- A general animation-sequencing/set-piece framework. This is scoped to the two proclamation
  sources that exist today (own-elimination, base-falls); a future proclamation source appends to
  the same enqueue step, it doesn't need new machinery.
- Changing what counts as proclamation-worthy, or the message text/timing of either existing
  proclamation.

## Decisions

**A queue (`string[]` state) drained one message at a time, not a single `proclamation` slot.** The
enqueue effect (keyed on `transitions`) appends every proclamation-worthy message produced by the
batch, in priority order, rather than picking one. A second effect (keyed on the queue and the
currently-shown message) shows the next queued message whenever nothing is currently showing,
starts its own 4s timeout, and clears the "currently showing" slot when that timeout fires -
letting the drain effect immediately pick up the next queued item, if any.

**`baseDamaged` (map shake) becomes its own independent effect**, no longer nested inside the
proclamation priority chain. It has no visual conflict with a proclamation banner (a shake plus a
banner read together as "your base got hit AND something else happened"), so there's no reason to
suppress it just because a proclamation also fired.

**Enqueue, don't replace.** The existing single-`proclamation`-state version replaced on every new
batch, which also meant a fast follow-up batch could cut off a still-displaying proclamation early.
The queue's drain step never clears an in-progress message until its own timeout elapses, so a
later batch's messages queue up behind it instead of interrupting it.

## Risks / Trade-offs

- **A player who triggers several proclamation-worthy events in quick succession (rare, but possible
  near a match's end) now sees a short sequence of banners instead of one.** This is the intended
  fix, not a regression: today that sequence silently collapses to whichever fired first.
- **The queue has no cap.** Not a practical concern - proclamation-worthy transitions are rare
  (elimination and base-capture events only), so the queue can't meaningfully back up during normal
  play.
