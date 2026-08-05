## Why

Live Playwright audit of the Land Grab Reveal overlay (`RevealOverlay.tsx`, shared by land grab and
battle) across all three target devices - iPhone 16 (393px), iPhone 17 (402px), OnePlus 13R (421px) -
found the ranked answer list's `reveal-answer` column truncated to **1-3 characters** on OnePlus 13R
for ordinary text answers ("December 7, 1941" rendered as "De...", a different wrong answer also
rendered as "Ju..."), making every row visually indistinguishable from every other - the one thing
this list exists to let a player check. The same reveal on iPhone 16/17 showed the answer in full or
near-full ("Lake Baikal", "Lake Tangany...").

Root cause: an earlier fix already narrowed `.reveal-row`'s grid columns (shrinking the name/speed-bar
tracks to reclaim width for the answer column) specifically to solve this exact failure mode, but
scoped it to `@media (max-width: 420px)`. OnePlus 13R's 421px viewport misses that threshold by a
single pixel, so it falls back to the wider, unshrunk columns the earlier fix exists to avoid - and
with more total column width spent on name/speed-bar before the answer's `1fr` share, the visible
result is worse than on the two narrower iPhones. This file's own comment elsewhere (`.player-card`,
~line 350) already documents this project's phone range as "~360-450px" - 420px was simply too tight
a cutoff for a phone this project now explicitly targets.

## What Changes

- `App.css`: widen the `.reveal-row` narrow-column media query from `max-width: 420px` to
  `max-width: 460px`, covering the full documented phone range (including OnePlus 13R at 421px and
  any similarly-sized Android flagship) with a small margin, while staying well short of the file's
  main 900px mobile/desktop breakpoint.
- No component/markup changes - this is a single breakpoint-value fix.

## Capabilities

### Modified Capabilities
- `mobile-viewport-interaction`: adds a requirement that a Reveal row's answer text stay legible
  (not collapsed to 1-2 characters) across the project's full documented phone-width range, not just
  the narrowest phones.

## Impact

- `src/Triviador.Client/src/App.css` (one media query threshold, `.reveal-row` narrow-column rule)
