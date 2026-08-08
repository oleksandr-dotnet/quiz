import { expect, test, type Page } from '@playwright/test'
import { answerAnyIfAsked, answerCorrectly, clickFirstEligibleRegion, revealWinnerName, setUpTwoPlayerBattle } from './helpers'
import { correctNumericValue } from './question-bank'

// Coverage: openspec/changes/base-assault-bonus-and-numeric-tiebreak's answer-ranking delta - a
// Choice-kind duel tied on correctness (both combatants correct) is broken by a numeric tiebreak
// question decided on closeness, with elapsed time only as the very last resort. A two-page, no-bot
// game (per this change's e2e-test-tooling delta) reaches Battle's first turn quickly - no need to
// wait for the round-8 base-assault-unlock threshold, since ordinary duels are available from
// Battle's very first turn.
//
// Correct answers are read from the same Data/questions/{choice,tip} content the server loads from
// disk (see specs/question-bank.ts) - never from a live secret channel, which the anti-cheat
// boundary never exposes before a question resolves.

/**
 * Attacks whichever adjacent region is currently offered, from whichever of the two pages is on turn.
 * With only two players sharing every region on a fully-connected map, some legal target always exists
 * between them - a stall here is transient UI/render lag (e.g. right after a RevealHold closes), never
 * a genuine "nobody can attack" state, so a generous budget just absorbs real-world timing variance
 * rather than masking an actual game-logic gap.
 */
async function attackFromWhoeverIsOnTurn(page: Page, page2: Page): Promise<void> {
  const deadline = Date.now() + 35_000
  while (Date.now() < deadline) {
    if (await clickFirstEligibleRegion(page)) return
    if (await clickFirstEligibleRegion(page2)) return
    await page.waitForTimeout(200)
  }
  throw new Error('attackFromWhoeverIsOnTurn: no attacker turn became available within 35s')
}

/**
 * Drives Battle turns, always attacking whoever's turn it is, until a Choice-kind duel/assault
 * question is drawn - then deliberately answers it correctly on both sides to force the "both
 * correct" tie this change's numeric-tiebreak behavior is keyed on. A Tip-kind question drawn
 * directly (unaffected by this change) is answered arbitrarily so the drive continues to the next
 * turn instead. Leaves both pages showing the follow-up numeric tiebreak question once it triggers.
 */
async function driveUntilTiebreakStarts(page: Page, page2: Page): Promise<void> {
  const deadline = Date.now() + 150_000
  while (Date.now() < deadline) {
    await attackFromWhoeverIsOnTurn(page, page2)
    await expect(page.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })
    await expect(page2.getByTestId('question-card')).toBeVisible({ timeout: 20_000 })

    const isChoice = await page.getByTestId('option-0').isVisible().catch(() => false)
    if (isChoice) {
      // Both combatants answer correctly (each computed independently off their own shown option
      // order, which QuestionDealer shuffles once per draw and broadcasts identically to every
      // participant, so this reliably forces the "both correct" tie this test is keyed on).
      await answerCorrectly(page)
      await answerCorrectly(page2)

      // Both answered correctly - the tied question's own reveal shows first, then the numeric
      // tiebreak question replaces it once that reveal's window closes.
      await expect(page.getByTestId('reveal-overlay')).toBeVisible({ timeout: 10_000 })
      await expect(page.getByTestId('reveal-overlay')).toBeHidden({ timeout: 15_000 })
      await expect(page.locator('.battle-headline')).toContainText(/closest number wins/i, { timeout: 10_000 })
      await expect(page.getByTestId('tip-input')).toBeVisible({ timeout: 10_000 })
      await expect(page2.getByTestId('tip-input')).toBeVisible({ timeout: 10_000 })
      return
    }

    await answerAnyIfAsked(page)
    await answerAnyIfAsked(page2)
    await expect(page.getByTestId('reveal-overlay')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('reveal-overlay')).toBeHidden({ timeout: 15_000 })
  }
  throw new Error('driveUntilTiebreakStarts: no Choice-question tie was reached within 150s')
}

test.describe('numeric tiebreak for a tied-correct Choice duel', () => {
  test.setTimeout(400_000)

  test('closeness decides the tiebreak even when the closer answer is slower, then elapsed time is the last resort for an equally-close tiebreak', async ({
    page,
    context,
  }) => {
    const page2 = await setUpTwoPlayerBattle(page, context)

    // --- Phase 1: closeness beats speed ---
    await driveUntilTiebreakStarts(page, page2)
    const promptText1 = (await page.getByTestId('question-card').locator('.question-text').textContent())?.trim() ?? ''
    const correctValue1 = correctNumericValue(promptText1)
    const farOffValue = correctValue1 + 1_000_000

    // Ada (page) answers immediately but far off; Bob (page2) answers exactly correctly two seconds
    // later. If elapsed time still mattered here, Ada (faster) would win - the point of this
    // assertion is that Bob wins instead, on closeness alone. Submits via Enter, not the on-screen
    // keypad's own submit button - App.css hides `.numeric-keypad` above 901px width (touch-only),
    // and this suite runs at a desktop viewport width.
    await page.getByTestId('tip-input').fill(String(farOffValue))
    await page.getByTestId('tip-input').press('Enter')
    await page.waitForTimeout(2_000)
    await page2.getByTestId('tip-input').fill(String(correctValue1))
    await page2.getByTestId('tip-input').press('Enter')

    await expect.poll(() => revealWinnerName(page), { timeout: 10_000, message: 'closer answer should win the tiebreak' }).toBe(
      'Bob',
    )

    await expect(page.getByTestId('reveal-overlay')).toBeHidden({ timeout: 15_000 })

    // --- Phase 2: an equally-close tiebreak (both exactly correct) falls back to elapsed time ---
    await driveUntilTiebreakStarts(page, page2)
    const promptText2 = (await page.getByTestId('question-card').locator('.question-text').textContent())?.trim() ?? ''
    const correctValue2 = correctNumericValue(promptText2)

    // Both submit the exact correct value (equal closeness, including both exactly right) - Ada
    // answers first this time, so Ada should win via elapsed time, the last-resort tiebreaker.
    await page.getByTestId('tip-input').fill(String(correctValue2))
    await page.getByTestId('tip-input').press('Enter')
    await page.waitForTimeout(2_000)
    await page2.getByTestId('tip-input').fill(String(correctValue2))
    await page2.getByTestId('tip-input').press('Enter')

    await expect.poll(() => revealWinnerName(page), { timeout: 10_000, message: 'faster answer should win an equally-close tiebreak' }).toBe(
      'Ada',
    )
  })
})
