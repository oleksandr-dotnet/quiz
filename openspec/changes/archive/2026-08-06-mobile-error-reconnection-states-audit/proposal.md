## Why

Error and reconnection UI - the connection-status banner, the leave-game/kick-player confirm
modals, and the client-side `ErrorBoundary` fallback - had not been specifically re-verified
against this session's three target devices (iPhone 16, iPhone 17, OnePlus 13R) or its
short-landscape widths (932x430, 975x450). These are the states easiest to get wrong on mobile
because they're overlays/banners layered on top of the fixed-height gameplay shell, exactly the
category `mobile-viewport-interaction`'s "connection-status banner never pushes the game shell
past the viewport" scenario exists to guard.

## What Changes

- No code changes. This iteration audited the above states with real Playwright automation against
  the running dev app (no DOM/store fabrication): rooms created via "Play vs 3 bots" and real
  two-tab lobby joins, real UI interactions, and `context.setOffline(true)` (network-level offline
  simulation, chosen over killing the shared dev server per this session's guardrails) to trigger
  SignalR's actual `onreconnecting`/`onclose` lifecycle - the real automatic-reconnect backoff
  (`[0, 1000, 2000, 5000, 10000]`) against the server's real `ClientTimeoutInterval` (30s) - and
  reach genuine `reconnecting` and `closed` states organically rather than synthetically. Every
  element was measured with `getBoundingClientRect()` / `scrollHeight` / `clientHeight`, not judged
  from screenshots alone (screenshots were taken too, for visual confirmation only).

- **Connection-status banner** (`ConnectionBadge`, both `Reconnecting...` and `Room closed` text):
  verified on iPhone 16 (393x659), iPhone 17 (402x681), OnePlus 13R (421x840), and both
  short-landscape widths (932x430, 975x450). `.connection-badge` is `position: fixed` (top:
  `max(0.75rem, env(safe-area-inset-top))`), so it never adds height above `.app-shell`.
  `.app-shell`'s `getBoundingClientRect()` stayed fully within the viewport (`top >= 0`, `bottom <=
  viewport height`) in every one of the 10 captures (5 viewports x 2 states), and
  `document.scrollingElement.scrollHeight - clientHeight` was exactly `0` throughout. The gameplay
  screen underneath remained fully visible and unclipped in every case. Working exactly as the
  existing spec scenario describes - no bug found.

- **Leave-game confirm modal** (`LeaveGameConfirmModal`): verified on all three devices, reached via
  the real mobile corner-menu path (`app-menu-button` -> `app-menu-leave`). `.confirm-card` fit
  fully within the viewport on every device, and both the confirm and cancel buttons measured
  exactly 44px tall (at or above the 44x44 CSS px minimum touch target), 303-331px wide depending on
  device. No bug found.

- **Kick-player confirm modal** (`KickConfirmModal`): verified both variants. The lobby single-button
  variant (`requireLandPolicy=false`) on all three devices via a real second human joining the room.
  The mid-game two-action-button variant (`requireLandPolicy=true` - release-land / bot-takeover /
  cancel) on iPhone 16, via a real two-human-plus-two-bot room driven through base selection into
  LandGrab (mirroring `kick-player.spec.ts`'s own setup). All buttons measured 44px tall in every
  capture; the card fit fully within the viewport in every case. The 2 untested
  device/variant combinations (mid-game variant on iPhone 17 / OnePlus 13R) share the same
  device-agnostic CSS (`.confirm-card`/`.confirm-actions` have no per-breakpoint override) already
  validated at three different viewport widths for the other variant, so this is a reasoned
  extrapolation rather than an untested gap. No bug found.

- **`ErrorBoundary` fallback** (`client-error-recovery` spec): reviewed statically rather than
  triggered live - forcing a genuine uncaught render error would have required a throwaway
  source-code change, against this session's guardrail against touching gameplay/app code for a UX
  investigation. `.error-boundary-fallback` uses `min-height: 100vh`/`100svh` with flex centering
  and a `max-width: 28rem` card (`ErrorBoundary.tsx` + `App.css`); the fallback's short
  title+message+reload-button content comfortably fits every target viewport including the
  430/450px-tall landscape ones. Unlike the gameplay shell, this fallback has no fixed-height/
  no-scroll requirement, so even if its content were ever taller it would scroll naturally rather
  than clip. No bug found.

This proposal exists purely to record the completed investigation (per this project's convention -
see `2026-08-06-finished-screen-overflow-audit`) so these now-verified-clean states aren't
re-investigated from scratch next time.

## Capabilities

No spec-level behavior changed - `mobile-viewport-interaction` and `client-error-recovery` already
correctly describe and cover every state audited here. `skip_specs: true` is set in this change's
`.openspec.yaml`.

## Impact

- No files under `src/` changed.
- Affected capabilities (audited, not modified): `mobile-viewport-interaction`,
  `client-error-recovery`.
