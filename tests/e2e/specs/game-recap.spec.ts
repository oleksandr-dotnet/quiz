import { expect, test } from '@playwright/test'

// Coverage note: the actual share/dedup/cross-viewer flow is covered as scenario 7 of
// battle-base-assault.spec.ts, appended onto that file's own already-expensive drive to a finished
// game rather than paying that cost again here (see this repo's own established pattern of folding
// scenarios into one expensive fixture). This file covers only what needs no game state at all.

test.describe('recap routes: edge cases reachable without a finished game', () => {
  test('an unknown or expired recap id renders a not-found state, not an error page', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('triviador.locale', 'en'))
    await page.goto('/recap/00000000-0000-0000-0000-000000000000')
    await expect(page.getByTestId('recap-screen-not-found')).toBeVisible({ timeout: 15_000 })
  })

  test('an unauthenticated visitor sees a sign-in prompt on the recap list', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('triviador.locale', 'en'))
    await page.goto('/recaps')
    await expect(page.getByTestId('my-recaps-screen')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('recap-sign-in-prompt')).toBeVisible()
  })
})
