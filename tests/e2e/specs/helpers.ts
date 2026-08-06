import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

// Matches RoomCodeGenerator's alphabet exactly: no 0/1/I/O (misread when read aloud).
export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/

export async function goToLanding(page: Page): Promise<void> {
  // The app's real default locale is Russian (see i18n/index.ts) - pin English here so this
  // suite's assertions on UI strings and aria-labels are deterministic regardless of that default.
  await page.addInitScript(() => {
    window.localStorage.setItem('triviador.locale', 'en')
  })
  await page.goto('/')
  await expect(page.getByTestId('display-name')).toBeVisible()
}

export async function createRoom(page: Page, name: string, mode: 'empty' | 'vsBots' = 'empty'): Promise<void> {
  await goToLanding(page)
  await page.getByTestId('display-name').fill(name)
  const testId = mode === 'vsBots' ? 'play-vs-bots' : 'create-room'
  await page.getByTestId(testId).click()
  await expect(page.getByTestId('seat-0')).toBeVisible()
}

/** Fills the 4-cell room-code input one character at a time, by its per-cell aria-label. */
async function fillRoomCode(page: Page, code: string): Promise<void> {
  for (let i = 0; i < code.length; i++) {
    await page.getByLabel(`Room code character ${i + 1}`).fill(code[i])
  }
}

export async function joinRoomByCode(page: Page, code: string, name: string): Promise<void> {
  await goToLanding(page)
  await page.getByTestId('display-name').fill(name)
  await fillRoomCode(page, code)
  await page.getByTestId('join-room').click()
}

export async function roomCodeOf(page: Page): Promise<string> {
  const code = (await page.getByTestId('room-code').textContent())?.trim() ?? ''
  if (!ROOM_CODE_PATTERN.test(code)) {
    throw new Error(`Expected a valid room code, got: "${code}"`)
  }
  return code
}

/** One seat row per seat, in seat order (matches SeatDto.seatIndex order). */
export function seatRows(page: Page) {
  return page.getByTestId(/^seat-\d+$/)
}

export function seatNameTexts(page: Page): Promise<string[]> {
  return seatRows(page).locator('.seat-name').allTextContents()
}

interface SeedIdentity {
  name: string
  roomCode?: string
  playerToken?: string
}

// The functions below all check visibility, then act - a real race against the *other* page's own
// concurrent action (this repo's polling loops call both pages' helpers every tick without knowing
// whose turn it really is). The state can move on - the question resolves, or the region-pick UI
// replaces it - in the gap between the check and the click. A short explicit timeout on the action
// itself (rather than letting it inherit the test's full remaining budget) turns that race into a
// fast, harmless no-op instead of a multi-minute hang: the next poll tick simply finds whatever
// actually came next.
const RACY_ACTION_TIMEOUT_MS = 3_000

/**
 * Clicks the first eligible (highlighted) region on the map, if one is currently offered on this
 * page, and returns its region id - works for base picks, land-grab picks, and battle attack-target
 * selection alike, since all three share the same GameMap `.selectable` rendering. Returns null (a
 * no-op) if nothing is currently offered on this page - safe to call on both pages every tick without
 * knowing in advance whose turn it is.
 */
export async function clickFirstEligibleRegion(page: Page): Promise<string | null> {
  const region = page.locator('g.region.selectable').first()
  if (!(await region.isVisible().catch(() => false))) return null
  const testId = await region.getAttribute('data-testid').catch(() => null)
  if (!testId) return null
  const clicked = await region
    .click({ timeout: RACY_ACTION_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false)
  return clicked ? testId.replace('region-', '') : null
}

/** Answers whatever question is currently showing on this page, if any and not already answered - value doesn't matter, just unblocks resolution. */
export async function answerAnyIfAsked(page: Page): Promise<void> {
  const option0 = page.getByTestId('option-0')
  if (await option0.isVisible().catch(() => false)) {
    await option0.click({ timeout: RACY_ACTION_TIMEOUT_MS }).catch(() => {})
    return
  }
  const tipInput = page.getByTestId('tip-input')
  if (await tipInput.isVisible().catch(() => false)) {
    // The on-screen numeric keypad (including its own submit button) is a touch-only affordance -
    // App.css hides `.numeric-keypad` above 901px width, where a desktop viewport is expected to
    // type into the input directly and submit with Enter (QuestionCard's onKeyDown handler).
    const filled = await tipInput
      .fill('0', { timeout: RACY_ACTION_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false)
    if (filled) {
      await tipInput.press('Enter', { timeout: RACY_ACTION_TIMEOUT_MS }).catch(() => {})
    }
  }
}

/**
 * Repeatedly takes whatever action is currently available on either page - answering a question, or
 * picking/attacking a region - until `condition` becomes true. Answers/picks/targets are arbitrary:
 * only progress matters to this helper, not correctness or who claims what. Shared by every scenario
 * that needs to fast-forward through base selection, land grab, and/or ordinary Battle turns before
 * its own controlled assertions begin (see e2e-test-tooling's "smallest game that still reaches it"
 * requirement - callers pair this with a two-page, no-bot-seats game).
 */
export async function fastForwardUntil(
  page: Page,
  page2: Page,
  condition: () => Promise<boolean>,
  timeoutMs = 180_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error(`fastForwardUntil: condition not met within ${timeoutMs}ms`)
    }
    await answerAnyIfAsked(page)
    await answerAnyIfAsked(page2)
    await clickFirstEligibleRegion(page)
    await clickFirstEligibleRegion(page2)
    await page.waitForTimeout(250)
  }
}

/** Fast-forwards through base selection and land grab (arbitrary answers/picks) until Battle begins. */
export async function fastForwardToBattle(page: Page, page2: Page): Promise<void> {
  await fastForwardUntil(page, page2, () => page.getByTestId('battle-dock').isVisible().catch(() => false), 180_000)
}

/** Reads the current round number from the persistent top-bar round-progress text ("Round 3/12 · ..."). */
export async function currentRound(page: Page): Promise<number> {
  const text = (await page.locator('.round-progress').first().textContent().catch(() => '')) ?? ''
  const match = text.match(/(\d+)\s*\//)
  return match ? Number(match[1]) : 0
}

/** Fast-forwards ordinary Battle turns (arbitrary answers/targets) until the round counter reaches `targetRound`. */
export async function fastForwardToRound(page: Page, page2: Page, targetRound: number): Promise<void> {
  await fastForwardUntil(page, page2, async () => (await currentRound(page)) >= targetRound, 240_000)
}

/**
 * Creates a room with exactly two human seats (no bots - the smallest game GameRules.MinPlayers
 * allows, per e2e-test-tooling's "smallest game that still reaches it" requirement), starts the
 * game, and fast-forwards through base selection and land grab into Battle's first turn. Returns the
 * second (joiner) page; the caller already has the first (host) page.
 */
export async function setUpTwoPlayerBattle(page: Page, context: import('@playwright/test').BrowserContext): Promise<Page> {
  await createRoom(page, 'Ada')
  const code = await roomCodeOf(page)

  const page2 = await context.newPage()
  await joinRoomByCode(page2, code, 'Bob')
  await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('base-selection-dock')).toBeVisible()
  await expect(page2.getByTestId('base-selection-dock')).toBeVisible()

  await fastForwardToBattle(page, page2)
  await expect(page.getByTestId('battle-dock')).toBeVisible()
  await expect(page2.getByTestId('battle-dock')).toBeVisible()

  return page2
}

/** The display name in the first (rank 1 / winning) row of whichever reveal is currently showing on this page, or null if no reveal is up. */
export async function revealWinnerName(page: Page): Promise<string | null> {
  const overlay = page.getByTestId('reveal-overlay')
  if (!(await overlay.isVisible().catch(() => false))) return null
  return overlay.locator('.reveal-row').first().locator('.reveal-name').textContent()
}

/**
 * Seeds localStorage (display name, shared across tabs) and, if a room/token pair is given,
 * sessionStorage (per-tab session) before the page's own scripts run - so App.tsx's auto-join
 * effect sees them on first load, exactly as it would for a real returning player.
 */
export async function seedIdentity(page: Page, identity: SeedIdentity): Promise<void> {
  await page.addInitScript((identity: SeedIdentity) => {
    window.localStorage.setItem('triviador.name', identity.name)
    if (identity.roomCode && identity.playerToken) {
      window.sessionStorage.setItem(
        'triviador.session',
        JSON.stringify({ roomCode: identity.roomCode, playerToken: identity.playerToken }),
      )
    }
  }, identity)
}
