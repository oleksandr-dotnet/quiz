## 1. Connection-status banner

- [x] 1.1 Scripted `play-vs-bots` playthrough on iPhone 16, iPhone 17, and OnePlus 13R, reaching
      base selection, then `context.setOffline(true)` to trigger a real SignalR `onreconnecting`.
- [x] 1.2 Waited for the real automatic-reconnect backoff to exhaust and `onclose` to fire, reaching
      the genuine `closed` state (no store/DOM fabrication).
- [x] 1.3 Measured `.connection-badge`, `.app-shell`, and `document.scrollingElement` rects/scroll
      metrics in both states, on all three devices plus short-landscape 932x430 and 975x450.
- [x] 1.4 Confirmed zero shell push, zero document-level scroll, in all 10 captures - no bug found.

## 2. Leave-game and kick-player confirm modals

- [x] 2.1 Triggered `LeaveGameConfirmModal` via the real mobile corner-menu path on all three
      devices; measured `.confirm-card` and both buttons' rects.
- [x] 2.2 Triggered `KickConfirmModal`'s lobby single-button variant (real second human joining) on
      all three devices.
- [x] 2.3 Triggered `KickConfirmModal`'s mid-game two-action-button variant (real two-human-plus-
      two-bot room driven into LandGrab) on iPhone 16.
- [x] 2.4 Confirmed every button measured >=44x44 CSS px and every card fit fully within its
      viewport - no bug found.

## 3. ErrorBoundary fallback

- [x] 3.1 Read `ErrorBoundary.tsx` and its `App.css` rules statically (no live trigger, to avoid a
      throwaway source-code change against this session's guardrails).
- [x] 3.2 Confirmed the fallback's centering/sizing has no fixed-height/no-scroll constraint and
      comfortably fits every target viewport including short-landscape ones - no bug found.
