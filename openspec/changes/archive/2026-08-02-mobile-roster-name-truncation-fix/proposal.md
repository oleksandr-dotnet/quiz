## Why

Live Playwright screenshots at the mobile roster breakpoint (`@media (max-width: 900px), (max-height:
500px)`, added in `mobile-landscape-short-viewport-fix`) show the 4-card player roster row rendering
`.player-name` down to a single letter plus ellipsis — `"A…"` for `AuditBot`, `"Б…"` for the default
`Бот` bot label — on the exact target devices (OnePlus 13 at 450px wide, iPhone 16 Pro Max/Plus at
430px wide). At 4 equal-width cards per row, each card gets roughly 100px; the existing card padding
(`0.7em` horizontal), inter-element gap (`0.5rem`), and 18px seat swatch together consume nearly all
of that before the name is laid out, leaving so little room that even a 3-character default bot name
doesn't fit. `.player-name`'s ellipsis truncation is correct behavior for a genuinely long custom
name, but a 3-letter default label truncating is a real readability regression, not the intended
trade-off.

## What Changes

- Inside the existing mobile breakpoint, tighten `.player-card`'s padding (`0.7em`→`0.4em`
  horizontal) and internal `gap` (`0.5rem`→`0.3rem`), shrink `.seat-swatch` from 18px to 14px, and
  reduce `.player-name`'s font-size to `0.85rem` — clawing back roughly 30-35px of width per card at
  the narrowest viewports in this breakpoint, enough for short/default names to render in full while
  a long custom name still truncates gracefully.
- No layout/structural change: still 4 cards in one non-wrapping row, same fields in the same order.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `mobile-viewport-interaction`: no requirement text change — this is a tuning fix within the
  existing "game screen fits the viewport without scrolling" / touch-target requirements, verified
  against a new concrete scenario (a short default name rendering in full on the narrowest phone
  widths this project targets).

## Impact

- `src/Triviador.Client/src/App.css` — mobile-breakpoint-only rules for `.player-card`,
  `.seat-swatch`, `.player-name`. No component/TSX changes, no server/domain changes.
