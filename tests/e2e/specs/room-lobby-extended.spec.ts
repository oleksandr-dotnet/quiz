import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { createRoom, goToLanding, joinRoomByCode, roomCodeOf, seatNameTexts, seatRows, seedIdentity } from './helpers'

// Coverage note: this file adds what plan section 2.1 lists as missing from room-lobby.spec.ts
// (create/join/full-via-bots/toggle/refresh/disconnect/leave/host-reassign are already covered
// there and are deliberately not repeated here). See tests/e2e/TEST-PLAN.md section 2.1.

/**
 * Fills the 4-cell room-code input by its per-cell aria-label - identical in spirit to helpers.ts's
 * own (unexported) fillRoomCode, kept local here per this file's ownership rules rather than editing
 * helpers.ts for one extra caller.
 */
async function enterRoomCode(page: Page, code: string): Promise<void> {
  for (let i = 0; i < code.length; i++) {
    await page.getByLabel(`Room code character ${i + 1}`).fill(code[i])
  }
}

/** Deep-link entry point: opens `#/room/<CODE>` directly, the same way a real invite link would. */
async function goToLandingViaDeepLink(page: Page, code: string): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('triviador.locale', 'en')
  })
  await page.goto(`/#/room/${code}`)
  await expect(page.getByTestId('display-name')).toBeVisible()
}

test.describe('room capacity', () => {
  test('four humans fill all seats; a 5th join is rejected as full', async ({ page, context }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const pageB = await context.newPage()
    await joinRoomByCode(pageB, code, 'Bob')
    const pageC = await context.newPage()
    await joinRoomByCode(pageC, code, 'Cleo')
    const pageD = await context.newPage()
    await joinRoomByCode(pageD, code, 'Dan')

    await expect(seatRows(page)).toHaveCount(4)
    expect(await seatNameTexts(page)).toEqual(['Ada (host)', 'Bob', 'Cleo', 'Dan'])

    const pageE = await context.newPage()
    await joinRoomByCode(pageE, code, 'Eve')

    await expect(pageE.getByRole('alert')).toBeVisible()
    await expect(pageE.getByTestId('seat-0')).toHaveCount(0)
    // The room itself is unaffected by the rejected attempt - still exactly 4 seats, unchanged names.
    await expect(seatRows(page)).toHaveCount(4)
    expect(await seatNameTexts(page)).toEqual(['Ada (host)', 'Bob', 'Cleo', 'Dan'])
  })

  test('two tabs racing the same last open seat: exactly one is seated, no ghost or duplicate occupant', async ({
    page,
    context,
  }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const pageB = await context.newPage()
    await joinRoomByCode(pageB, code, 'Bob')
    await expect(seatRows(pageB).nth(1).locator('.seat-name')).toHaveText('Bob')
    const pageC = await context.newPage()
    await joinRoomByCode(pageC, code, 'Cleo')
    await expect(seatRows(pageC).nth(2).locator('.seat-name')).toHaveText('Cleo')

    // Exactly one open seat (index 3) remains. Prepare both racers fully (name filled, code entered)
    // before either submits, then fire both join clicks together so the actual hub calls land close
    // together - RoomActor's single-mailbox pump still serializes them, but this is as close to a
    // real race as driving two real browser tabs allows.
    const pageD = await context.newPage()
    const pageE = await context.newPage()
    await goToLanding(pageD)
    await goToLanding(pageE)
    await pageD.getByTestId('display-name').fill('Dan')
    await pageE.getByTestId('display-name').fill('Eve')
    await enterRoomCode(pageD, code)
    await enterRoomCode(pageE, code)

    await Promise.all([pageD.getByTestId('join-room').click(), pageE.getByTestId('join-room').click()])

    // The room settles at exactly 4 filled seats with no duplicate occupant, regardless of who won.
    await expect(seatRows(page).nth(3).locator('.seat-name')).not.toHaveText('Open')
    const namesAfter = await seatNameTexts(page)
    expect(namesAfter).toHaveLength(4)
    expect(namesAfter).not.toContain('Open')
    expect(new Set(namesAfter).size).toBe(4)

    const winnerName = namesAfter[3]
    expect(['Dan', 'Eve']).toContain(winnerName)
    const winnerPage = winnerName === 'Dan' ? pageD : pageE
    const loserPage = winnerName === 'Dan' ? pageE : pageD

    await expect(winnerPage.getByTestId('seat-0')).toBeVisible()
    await expect(loserPage.getByRole('alert')).toBeVisible()
    await expect(loserPage.getByTestId('seat-0')).toHaveCount(0)
  })
})

test.describe('host seat controls', () => {
  test('the host has no bot/open toggle on a seat held by a connected human', async ({ page, context }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const pageB = await context.newPage()
    await joinRoomByCode(pageB, code, 'Bob')
    await expect(seatRows(page).nth(1).locator('.seat-name')).toHaveText('Bob')

    // LobbyScreen only renders the toggle button when the seat is not connected (see
    // `view.youAreHost && !seat.isConnected` in LobbyScreen.tsx) - Bob's live tab means the host has
    // no way to bot/open his seat.
    await expect(seatRows(page).nth(1).getByRole('button', { name: /Fill with bot|Open seat/ })).toHaveCount(0)
    // Contrast check: the affordance still exists on a genuinely open seat, so the absence above is
    // the seat's connected state at work, not some broader rendering failure.
    await expect(seatRows(page).nth(2).getByRole('button', { name: 'Fill with bot' })).toBeVisible()
  })

  test('start-game is unavailable with a single occupied seat and becomes available with a second', async ({
    page,
    context,
  }) => {
    await createRoom(page, 'Ada')
    await expect(page.getByTestId('start-game')).toBeDisabled()

    const code = await roomCodeOf(page)
    const pageB = await context.newPage()
    await joinRoomByCode(pageB, code, 'Bob')
    await expect(seatRows(page).nth(1).locator('.seat-name')).toHaveText('Bob')

    await expect(page.getByTestId('start-game')).toBeEnabled()
  })
})

test.describe('deep-link join', () => {
  test('a deep link #/room/<CODE> seats a joiner directly, with no manual code entry', async ({ page, context }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const pageB = await context.newPage()
    await goToLandingViaDeepLink(pageB, code)
    // Invite mode (LandingScreen's isInviteMode) collapses the form to name + a single pre-targeted
    // join button - the manual 4-cell code entry never renders at all.
    await expect(pageB.getByTestId('join-code')).toHaveCount(0)

    await pageB.getByTestId('display-name').fill('Bob')
    await pageB.getByTestId('join-room').click()

    await expect(pageB.getByTestId('seat-0')).toBeVisible()
    await expect(seatRows(page).nth(1).locator('.seat-name')).toHaveText('Bob')
  })
})

test.describe('reconnection interleaved with a new join', () => {
  test('closing a tab, a new player taking the other seat, then the original reopening reclaims their own seat', async ({
    page,
    context,
  }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const pageB = await context.newPage()
    await joinRoomByCode(pageB, code, 'Bob')
    await expect(seatRows(pageB).nth(1).locator('.seat-name')).toHaveText('Bob')

    // Capture Bob's session exactly as a real returning player's browser would still hold it in
    // sessionStorage, before the tab that created it is gone.
    const bobSessionRaw = await pageB.evaluate(() => window.sessionStorage.getItem('triviador.session'))
    expect(bobSessionRaw).not.toBeNull()
    const bobSession = JSON.parse(bobSessionRaw!) as { roomCode: string; playerToken: string }

    await pageB.close()
    await expect(seatRows(page).nth(1).locator('.seat-name')).toHaveText('Bob (disconnected)')

    // Cleo joins - since Bob's seat is disconnected, not open, she must land in seat 2, not seat 1.
    const pageC = await context.newPage()
    await joinRoomByCode(pageC, code, 'Cleo')
    await expect(seatRows(pageC).nth(2).locator('.seat-name')).toHaveText('Cleo')

    // Bob reopens with his stored session token - HandleJoinAsync matches it to his existing seat
    // and just updates its connectionId, rather than treating this as a brand new join.
    const pageB2 = await context.newPage()
    await seedIdentity(pageB2, { name: 'Bob', roomCode: bobSession.roomCode, playerToken: bobSession.playerToken })
    await pageB2.goto('/')
    await expect(pageB2.getByTestId('seat-0')).toBeVisible()

    expect(await seatNameTexts(page)).toEqual(['Ada (host)', 'Bob', 'Cleo', 'Open'])
  })
})

test.describe('seat lifecycle after the game starts', () => {
  test('no seat offers any occupant-changing control once the game has started', async ({ page, context }) => {
    test.setTimeout(60_000)
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const pageB = await context.newPage()
    await joinRoomByCode(pageB, code, 'Bob')
    await expect(seatRows(pageB).nth(1).locator('.seat-name')).toHaveText('Bob')

    await page.getByTestId('start-game').click()
    await expect(page.getByTestId('base-selection-dock').or(page.getByTestId('category-ban-card'))).toBeVisible()

    // LobbyScreen - the only place seat toggle buttons exist - unmounts entirely the instant a
    // GameView arrives (App.tsx switches away once `gameView` is non-null), so the seat list and its
    // toggle affordances are gone outright rather than merely disabled.
    await expect(page.getByTestId(/^seat-\d+$/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Fill with bot|Open seat/ })).toHaveCount(0)
  })
})
