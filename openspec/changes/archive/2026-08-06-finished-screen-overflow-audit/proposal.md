## Why

The most recent prior audit (`2026-08-06-base-hit-points-display-fix`) left an UNCONFIRMED lead: a
possible Finished-screen standings-list overflow on iPhone 16/17, spotted in a screenshot with the
"Copy result"/"Return to start" buttons out of frame, but flagged as likely a false-positive from a
screenshot taken before the dock's scroll-shadow settle-poll (`AppShell.tsx`'s 8x120ms poll) and the
Finished dock's own 0.42s entrance transition had finished. This iteration's job was to confirm or
refute it with real measurements taken after properly waiting for settle, and to fix it if real.

A scripted, real-UI playthrough (`play-vs-bots`, real clicks/answers through the actual client, no
store/DOM state fabrication) reached the Finished screen on all three target devices in parallel
(iPhone 16, iPhone 17, OnePlus 13R), waited 2.5s past Finished-dock mount (comfortably past both the
960ms settle-poll and the 420ms entrance transition), then measured `getBoundingClientRect()` and
`scrollHeight`/`clientHeight` directly rather than eyeballing a screenshot.

**Result: confirmed NOT a bug.** On iPhone 16 (393x659) and iPhone 17 (402x681), `.shell-dock` is
genuinely taller than its visible area (`scrollHeight` 391 vs `clientHeight` 273/290 - an ~118px
overflow), so at `scrollTop: 0` the "Copy result"/"Return to start" buttons do sit below the visible
dock area (`returnBtnRect.top` 668/672 vs viewport height 659/681) - the screenshot iteration 9 saw
was accurate, not a settle-timing artifact. But this is exactly `.shell-dock`'s sanctioned scroll
fallback (`mobile-viewport-interaction`'s "dock SHALL become internally scrollable... SHALL show a
visible fade cue" requirement, implemented by `dock-scroll-shadow-affordance`), working as designed:
`dock-scroll-shadow-bottom` was `visible` with `opacity: 1` at `scrollTop: 0` (correctly signaling
more content below), and scrolling the dock to its end brought both buttons fully into view
(`returnBtnRect` 550-611 / 571-633, well within the viewport) with the bottom shadow correctly
disappearing. OnePlus 13R's taller 840px viewport doesn't overflow at all (`scrollHeight ==
clientHeight == 429`), matching the spec's "a viewport where content already fills the shell is
unaffected" scenario. No document-level scroll occurred on any device (`documentScrollable: false`
throughout). No code change follows from this - the existing mechanism already covers it correctly.

With the lead closed as a non-issue, this iteration's second half did the normal-scope mobile UX pass
the base-hit-points-display-fix report suggested for a future iteration: a fresh look at Land Grab
Choice/Tip questions and reveals, Battle target-selection, and specifically base-assault's mid-flow
states (health changes and question-index progression across a chain), which prior iterations had
only confirmed reachability for, not exhaustively reviewed the layout of.

A second scripted playthrough instrumented to snapshot every distinct dock/question/reveal state (by
`data-testid` plus, for Battle, the rendered headline text) captured 177 distinct real states across
all three devices - including three complete base-assault chains (headline progressing "hit 1 of 5"
through "hit 5 of 5" - or the Russian equivalent, since `GameRules.Language` defaults to Russian and
no locale override was set, incidentally stress-testing the longer Cyrillic strings too) plus ordinary
duels, land-grab Choice/Tip questions, and reveals. Measuring every capture:

- `document.scrollingElement`'s `scrollHeight - clientHeight` was exactly 0 in all 177 captures - no
  document-level scroll ever occurred, on any device, in any phase, including the tallest states (a
  Tip question mid-assault produced the largest `.shell-dock` overflow seen, 230px, still fully
  contained by the dock's own scroll fallback rather than the document).
- No captured `question-card`, `tip-input`, `numeric-keypad`, or `reveal-overlay` rect extended past
  its viewport's left/right edges (no horizontal overflow) on any device.
- Every Choice-question option button measured at least 344px wide and 58px tall - well above the
  44x44 CSS px minimum touch target.

No new bug found. This iteration ships no code change - just this record, so the confirmed-dead lead
isn't re-investigated and the now-audited flows (Land Grab, Battle including base-assault's mid-flow
states) don't need a from-scratch playthrough next time.

## What Changes

- No production code changes. This proposal exists to record a completed investigation (per this
  project's "ship the OpenSpec notes even when there's no code fix" convention) so the finding is
  discoverable by future iterations instead of being re-litigated.

## Impact

- No files under `src/` changed.
- Affected capability: `mobile-viewport-interaction` (audited, not modified - existing requirements
  already correctly describe and cover the observed behavior).
