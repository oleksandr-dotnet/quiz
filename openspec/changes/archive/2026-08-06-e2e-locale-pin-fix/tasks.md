## 1. Pin the suite's UI language

- [x] 1.1 In `tests/e2e/specs/helpers.ts`'s `goToLanding()`, add a `page.addInitScript` that sets
      `localStorage['triviador.locale'] = 'en'` before `page.goto('/')`

## 2. Verification

- [x] 2.1 `cd tests/e2e && npm test`: 16/16 pass (was 4/16), full run in 49s (was 4.7min - the 12
      failures were each a 30s timeout)
- [x] 2.2 `cd src/Triviador.Client && npx tsc -b --noEmit` passes (test-helper-only change, no
      client app code touched)
- [x] 2.3 `dotnet build` passes
