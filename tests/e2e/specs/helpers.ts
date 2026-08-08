import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { correctChoiceIndex, correctNumericValue } from './question-bank'

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
 * Submits an empty category-ban proposal if the ban card is currently up on this page (a no-op
 * proposal is a legal submission per category-ban-draft), so a caller that doesn't care about which
 * categories get banned can just get past this phase. Tolerates the card not being there at all
 * (GameRules.EnableCategoryBanDraft off) and tolerates it being up but already sealed (own
 * resubmission is impossible by design) - both are silent no-ops, never a throw, so this is safe to
 * call speculatively on every poll tick without knowing the phase in advance.
 */
export async function passCategoryBanIfPresent(page: Page): Promise<void> {
  const card = page.getByTestId('category-ban-card')
  if (!(await card.isVisible().catch(() => false))) return
  const submit = page.getByTestId('category-ban-submit')
  if (await submit.isVisible().catch(() => false)) {
    await submit.click({ timeout: RACY_ACTION_TIMEOUT_MS }).catch(() => {})
  }
}

/**
 * Closes the category-ban result popup (CategoryBanResultPopup.tsx) if it is currently showing, so it
 * never lingers over base-selection's map underneath. It also auto-dismisses on its own after ~6s,
 * so this is a convenience for tests that can't afford to wait that long, not a correctness
 * requirement - a no-op if the popup isn't up. Closed by its own `.category-ban-result-close` button
 * rather than its aria-label text, so this doesn't depend on the pinned English locale.
 */
export async function dismissCategoryBanResultIfPresent(page: Page): Promise<void> {
  const popup = page.getByTestId('category-ban-result-popup')
  if (!(await popup.isVisible().catch(() => false))) return
  await popup
    .locator('.category-ban-result-close')
    .click({ timeout: RACY_ACTION_TIMEOUT_MS })
    .catch(() => {})
}

/**
 * Repeatedly takes whatever action is currently available on either page - answering a question, or
 * picking/attacking a region - until `condition` becomes true. Answers/picks/targets are arbitrary:
 * only progress matters to this helper, not correctness or who claims what. Shared by every scenario
 * that needs to fast-forward through base selection, land grab, and/or ordinary Battle turns before
 * its own controlled assertions begin (see e2e-test-tooling's "smallest game that still reaches it"
 * requirement - callers pair this with a two-page, no-bot-seats game). Also tolerates CategoryBan
 * appearing mid-drive (a caller that left the lobby settings at their default lands here right after
 * StartGame) so a game driven with settings ON still progresses instead of stalling on the ban card.
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
    await passCategoryBanIfPresent(page)
    await passCategoryBanIfPresent(page2)
    await dismissCategoryBanResultIfPresent(page)
    await dismissCategoryBanResultIfPresent(page2)
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

/**
 * Reads the current round number from the persistent top-bar round-progress text ("Round 3/12 ...").
 * `.round-progress` only renders once `view.phase === 'Battle'` (see App.tsx) - before that, this
 * locator matches zero elements. A bare `textContent()` call auto-waits for the element to attach
 * with no bound of its own (Playwright's own default, well past what a caller polling every ~200ms
 * expects), so an explicit short timeout here is load-bearing: without it, a caller that polls this
 * before Battle has started - as opposed to every existing caller, which only does so after already
 * confirming `battle-dock` is visible - stalls for the whole of that wait on every single poll tick.
 */
export async function currentRound(page: Page): Promise<number> {
  const text = (await page.locator('.round-progress').first().textContent({ timeout: 1_000 }).catch(() => '')) ?? ''
  const match = text.match(/(\d+)\s*\//)
  return match ? Number(match[1]) : 0
}

/** Fast-forwards ordinary Battle turns (arbitrary answers/targets) until the round counter reaches `targetRound`. */
export async function fastForwardToRound(page: Page, page2: Page, targetRound: number): Promise<void> {
  await fastForwardUntil(page, page2, async () => (await currentRound(page)) >= targetRound, 240_000)
}

interface LobbySettings {
  answerStreaks?: boolean
  categoryBanDraft?: boolean
  goldenQuestion?: boolean
}

const LOBBY_SETTING_TEST_ID: Record<keyof LobbySettings, string> = {
  answerStreaks: 'setting-answer-streaks',
  categoryBanDraft: 'setting-category-ban-draft',
  goldenQuestion: 'setting-golden-question',
}

/**
 * Host-only: sets each named lobby checkbox (LobbyScreen.tsx's game-settings-panel) to the requested
 * state, leaving any unnamed setting untouched. Only clicks a checkbox whose current state actually
 * differs from the request (a click always toggles, so a no-op click would flip it the wrong way),
 * then waits for the checkbox's own checked state - bound to the projected GameSettingsView, not
 * local component state - to settle at the requested value. `setGameSettings` is a real hub
 * round-trip, so without that wait a caller's StartGame click right after could race a write still
 * in flight and start the game on the pre-toggle defaults. Settings are fixed at StartGame, so this
 * must run before it.
 */
export async function setLobbySettings(page: Page, settings: LobbySettings): Promise<void> {
  for (const key of Object.keys(LOBBY_SETTING_TEST_ID) as (keyof LobbySettings)[]) {
    const desired = settings[key]
    if (desired === undefined) continue
    const checkbox = page.getByTestId(LOBBY_SETTING_TEST_ID[key])
    if ((await checkbox.isChecked()) !== desired) {
      await checkbox.click()
    }
    await expect(checkbox).toBeChecked({ checked: desired, timeout: 10_000 })
  }
}

/**
 * Clicks `start-game` on the host page, then walks every page past CategoryBan if that phase appears
 * (GameRules.EnableCategoryBanDraft) - submitting an empty proposal and dismissing the result popup
 * on each - and finally asserts every page reaches `base-selection-dock`. Safe to call regardless of
 * whether category-ban-draft is on or off: with it off, the loop's first check already finds every
 * page at base selection and returns immediately.
 */
export async function startGameAndReachBaseSelection(pages: readonly Page[]): Promise<void> {
  await pages[0].getByTestId('start-game').click()

  const deadline = Date.now() + 60_000
  for (;;) {
    let allReady = true
    for (const page of pages) {
      await passCategoryBanIfPresent(page)
      await dismissCategoryBanResultIfPresent(page)
      if (!(await page.getByTestId('base-selection-dock').isVisible().catch(() => false))) {
        allReady = false
      }
    }
    if (allReady) break
    if (Date.now() > deadline) break // let the assertions below produce the real failure message
    await pages[0].waitForTimeout(250)
  }

  for (const page of pages) {
    await expect(page.getByTestId('base-selection-dock')).toBeVisible()
  }
}

/**
 * Creates a room with exactly two human seats (no bots - the smallest game GameRules.MinPlayers
 * allows, per e2e-test-tooling's "smallest game that still reaches it" requirement), pins the three
 * add-streak-ban-golden-mechanics lobby settings (deterministic scoring is the right default for a
 * battle-focused setup; `opts` re-enables any of them for a test that specifically wants to cover
 * their interaction with Battle), starts the game, and fast-forwards through base selection and land
 * grab into Battle's first turn. Returns the second (joiner) page; the caller already has the first
 * (host) page.
 */
export async function setUpTwoPlayerBattle(
  page: Page,
  context: import('@playwright/test').BrowserContext,
  opts?: LobbySettings,
): Promise<Page> {
  await createRoom(page, 'Ada')
  const code = await roomCodeOf(page)

  const page2 = await context.newPage()
  await joinRoomByCode(page2, code, 'Bob')
  await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

  await setLobbySettings(page, {
    answerStreaks: opts?.answerStreaks ?? false,
    categoryBanDraft: opts?.categoryBanDraft ?? false,
    goldenQuestion: opts?.goldenQuestion ?? false,
  })

  await startGameAndReachBaseSelection([page, page2])

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

// The score span (components/Odometer.tsx) animates toward its new value over ~320ms - wait past
// that before reading, so a read right after some earlier score change doesn't catch a mid-animation
// transient value instead of the settled one.
export async function readScore(page: Page, seat: number): Promise<number> {
  await page.waitForTimeout(500)
  const text = await page.getByTestId(`player-card-${seat}`).locator('.score').textContent()
  return Number(text)
}

/** The currently-showing question card's prompt text, trimmed - throws if no question is up. */
async function currentQuestionPromptText(page: Page): Promise<string> {
  const text = await page.getByTestId('question-card').locator('.question-text').textContent()
  return (text ?? '').trim()
}

/** The currently-shown Choice options, with QuestionCard's leading ①②③④ hint glyph stripped. */
async function shownChoiceOptionTexts(page: Page): Promise<string[]> {
  return (await page.locator('.option-plate').allTextContents()).map((t) => t.replace(/^[①②③④]\s*/, ''))
}

/**
 * Answers the currently-shown question card correctly, for either kind (Choice or Tip/numeric) -
 * generalizes the inline duplicated logic from battle-base-assault-bonus.spec.ts and
 * battle-numeric-tiebreak.spec.ts. The correct answer is read from the same static content the
 * server loads from disk (see question-bank.ts), never from a live secret channel the anti-cheat
 * boundary wouldn't expose before resolution.
 */
export async function answerCorrectly(page: Page): Promise<void> {
  const isChoice = await page.getByTestId('option-0').isVisible().catch(() => false)
  const promptText = await currentQuestionPromptText(page)
  if (isChoice) {
    const correctIndex = correctChoiceIndex(promptText, await shownChoiceOptionTexts(page))
    await page.getByTestId(`option-${correctIndex}`).click()
    return
  }
  await page.getByTestId('tip-input').fill(String(correctNumericValue(promptText)))
  await page.getByTestId('tip-input').press('Enter')
}

/**
 * Answers the currently-shown question card deliberately wrong, for either kind - a Choice pick one
 * slot away from correct (wrapping), or a Tip value a million off the correct one (Tip correctness is
 * closeness-based, not exact-match, so this guarantees a clearly-losing submission regardless of the
 * question's own unit/scale).
 */
export async function answerIncorrectly(page: Page): Promise<void> {
  const isChoice = await page.getByTestId('option-0').isVisible().catch(() => false)
  const promptText = await currentQuestionPromptText(page)
  if (isChoice) {
    const shownOptions = await shownChoiceOptionTexts(page)
    const correctIndex = correctChoiceIndex(promptText, shownOptions)
    const wrongIndex = (correctIndex + 1) % shownOptions.length
    await page.getByTestId(`option-${wrongIndex}`).click()
    return
  }
  await page.getByTestId('tip-input').fill(String(correctNumericValue(promptText) + 1_000_000))
  await page.getByTestId('tip-input').press('Enter')
}

/**
 * Reads territory ownership straight off RegionShape's `data-owner-seat` attribute (added
 * specifically for this harness - ownership was previously only encoded presentationally, as fill
 * color/hatch pattern, with no DOM-readable source of truth). Returns null for an unclaimed region.
 */
export async function regionOwnerSeatOf(page: Page, regionId: string): Promise<number | null> {
  const seat = await page.getByTestId(`region-${regionId}`).getAttribute('data-owner-seat')
  return seat === null ? null : Number(seat)
}

/** Every region id currently owned by `seat`, in whatever order the DOM returns them (unordered). */
export async function ownedRegionIds(page: Page, seat: number): Promise<string[]> {
  const testIds = await page
    .locator(`g.region[data-owner-seat="${seat}"]`)
    .evaluateAll((elements) => elements.map((el) => el.getAttribute('data-testid')))
  return testIds.filter((id): id is string => id !== null).map((id) => id.replace('region-', ''))
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
