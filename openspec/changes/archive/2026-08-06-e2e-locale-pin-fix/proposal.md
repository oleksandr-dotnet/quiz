## Why

`npm test` in `tests/e2e` was failing 12 of its 16 tests (all of `room-lobby.spec.ts`), first
noticed and confirmed pre-existing (via `git stash` A/B testing) by the
`mobile-roster-name-full-width-fix` change. Root cause found this iteration: the app's real default
locale is Russian (`src/Triviador.Client/src/i18n/index.ts` - `storedLocale()` returns `'ru'`
whenever no `triviador.locale` preference is stored yet, and `fallbackLng: 'ru'`), which is correct,
intentional product behavior. `room-lobby.spec.ts` and its `helpers.ts` were written assuming an
English default: they assert hardcoded English seat text (`'Ada (host)'`, `'Open'`, `'Bot'`) and, for
every test that fills the room-code input, look it up by its English aria-label
(`getByLabel('Room code character 1')`). Under the real Russian default, those lookups/assertions
either time out (30s per test) or fail a text-equality check - a test-harness gap, not a product bug.

This directly weakens every future iteration of the mobile-UX loop: "run the e2e suite before
pushing" is one of this loop's own guardrails, and a suite that's 75% red regardless of the change
under test provides no actual signal.

## What Changes

- `tests/e2e/specs/helpers.ts`'s `goToLanding()` now seeds `localStorage['triviador.locale'] = 'en'`
  via `page.addInitScript` before navigating, so every test that goes through it (all of them, either
  directly or via `createRoom`/`joinRoomByCode`) gets a deterministic English UI regardless of the
  app's real Russian default. No production/app code changed.

## Capabilities

### Modified Capabilities
- `e2e-test-tooling`: adds a requirement that the suite's own UI-language assumption is pinned
  explicitly rather than riding on whatever the app's default happens to be.

## Impact

- `tests/e2e/specs/helpers.ts` only. No `src/Triviador.Client`, server, or domain changes.
- Result: `npm test` in `tests/e2e` goes from 4/16 passing (4.7min, dominated by 30s timeouts) to
  16/16 passing (49s).
