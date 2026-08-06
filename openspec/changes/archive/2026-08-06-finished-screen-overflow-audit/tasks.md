## 1. Investigation

- [x] 1.1 Scripted `play-vs-bots` playthrough (real UI clicks/answers, no state fabrication) on all
      three target devices in parallel, reaching the Finished screen on each.
- [x] 1.2 Waited 2.5s past Finished-dock mount (past both `AppShell`'s 960ms scroll-shadow
      settle-poll and the Finished dock's 420ms entrance transition) before measuring.
- [x] 1.3 Measured `.shell-dock` `scrollHeight`/`clientHeight`, the results buttons'
      `getBoundingClientRect()`, and the scroll-shadow's visibility/opacity at rest and after
      scrolling the dock to its end, on all three devices.
- [x] 1.4 Confirmed the standings-list overflow is real on iPhone 16/17 but is exactly the
      already-shipped scroll-fallback-plus-fade-cue mechanism working correctly (not a layout bug) -
      no code change needed.

## 2. Follow-up audit (normal-scope mobile UX pass)

- [x] 2.1 Second scripted playthrough instrumented to capture every distinct Land Grab / Battle /
      base-assault dock, question, and reveal state (177 total across three devices, including three
      full base-assault chains) with layout measurements.
- [x] 2.2 Verified zero document-level scroll, zero horizontal overflow, and no touch target under
      44x44 CSS px across every captured state.
- [x] 2.3 No new bug found - no code change follows.
