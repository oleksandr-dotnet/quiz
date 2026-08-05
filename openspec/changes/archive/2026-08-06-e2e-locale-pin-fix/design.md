## Context
`tests/e2e/playwright.config.ts` sets no `locale`, and even if it did, Playwright's browser-level
`locale` option only affects `navigator.language`/`Accept-Language` - this app never reads either; it
only reads its own `localStorage['triviador.locale']` key (defaulting to `'ru'` when absent). So the
fix has to happen at that storage key, not at the Playwright browser-context level.

## Decision
Seed `localStorage['triviador.locale'] = 'en'` via `page.addInitScript` inside `goToLanding()`, the
one helper every test already routes through (directly or via `createRoom`/`joinRoomByCode`). This
mirrors the existing `seedIdentity()` pattern in the same file (also an `addInitScript` seeding a
different key) rather than introducing a new mechanism.

## Alternatives considered
- **Set `locale: 'en-US'` in `playwright.config.ts`**: rejected - no effect, since the app doesn't
  read the browser locale at all.
- **Seed at the Playwright `use.storageState` / global-setup level**: rejected - `storageState` seeds
  cookies/origin storage from a saved file, which is more machinery than a one-line `addInitScript`
  for a single key, and wouldn't sit next to the existing `seedIdentity` pattern readers already know.
- **Change the app's default locale to English**: rejected outright - the Russian default is an
  intentional product decision (this project's primary content is Russian-language), not a bug to fix.

## Risks
- None identified: this only affects the E2E suite's own browser contexts, not the shipped app.
