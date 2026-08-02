## Why

A third, independently-scoped Explore sweep (deliberately pointed at LandingScreen/LobbyScreen/
ErrorBoundary, the only client screens neither of the first two sweeps this session had reviewed)
found the most severe bug of the session: the mobile breakpoint's rubber-band backstop —

```css
html, body, #root { height: 100%; overflow: hidden; overscroll-behavior: none; }
```

— is a bare, unconditional selector, so it applies to *every* screen at this breakpoint, not only
the in-game `.app-shell` it was written for. `LandingScreen`/`LobbyScreen` render with no
`.app-shell` wrapper and no height cap of their own (by design — the `mobile-viewport-interaction`
spec's "fits the viewport without scrolling" requirement only covers actual gameplay phases;
Landing/Lobby were always meant to scroll normally if their content runs long). Their content is
comfortably taller than a short-landscape viewport (~541-593px vs. the ~380-450px this project's
short-landscape phones give), so the Join Room button on Landing and the Start Game button on Lobby
end up positioned below the fold — and with document scroll hard-disabled, **there is no way to
reach them at all**. Confirmed live: `getBoundingClientRect()` placed both buttons past
`window.innerHeight`, `document.documentElement.scrollHeight === clientHeight` (the overflow was
truly clipped, not just visually off-screen), and an explicit `window.scrollTo(0, 9999)` call left
`scrollY` unchanged at 0.

This bug already existed for landscape phones narrow enough to fall under the breakpoint's original
`max-width: 900px` arm (verified: iPhone 16 at 852×393 landscape has the identical lockout) — it
predates this session. But this session's own `mobile-landscape-short-viewport-fix` (adding the
`max-height: 500px` arm so the *in-game* screens would fit correctly on wider-but-short landscape
phones) had the side effect of widening this pre-existing Landing/Lobby lockout's blast radius to
the two largest phones this project explicitly targets, iPhone 16 Plus/Pro Max and OnePlus 13. On
those devices in landscape, a player literally cannot join a room by code or start a game from the
lobby — the game is unplayable in that orientation via those two actions.

## What Changes

- Scope the rubber-band backstop to only the screens it was actually written for, using `:has()`:
  `html:has(.app-shell), body:has(.app-shell), #root:has(.app-shell)` instead of a bare
  `html, body, #root`. `.app-shell` is only ever rendered during actual gameplay (`App.tsx` renders
  `LandingScreen`/`LobbyScreen` with no `.app-shell` wrapper); this restores normal document
  scrolling on Landing/Lobby at this breakpoint while leaving the in-game no-scroll behavior
  completely unchanged.
- No other change: the in-game fitted-viewport requirement, the touch-target floor, and every other
  rule already inside this breakpoint are unaffected.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `mobile-viewport-interaction`: adds a requirement that Landing/Lobby remain scrollable (never
  scroll-locked) on any viewport where their content exceeds the available height, since they are
  explicitly exempt from the fitted-no-scroll requirement that governs actual gameplay phases.

## Impact

- `src/Triviador.Client/src/App.css` — one selector change (three selectors gain `:has(.app-shell)`
  scoping). No component/TSX changes, no server/domain changes. Requires `:has()` support (Chrome
  105+, Safari 15.4+, Firefox 121+) — comfortably covered by this project's target devices (current
  iOS/Android flagships).
