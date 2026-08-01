import { expect, test } from '@playwright/test'
import {
  ROOM_CODE_PATTERN,
  createRoom,
  goToLanding,
  joinRoomByCode,
  roomCodeOf,
  seatNameTexts,
  seatRows,
  seedIdentity,
} from './helpers'

// Coverage note: every scenario in openspec/specs/room-lobby/spec.md is exercised here except
// "Idle rooms are eventually removed" - RoomOptions.IdleThreshold defaults to 15 minutes and isn't
// configurable via appsettings, so it's excluded as impractical for a routine E2E run rather than
// silently skipped. See tests/e2e/README.md.

test.describe('creating and joining a room', () => {
  test('creating a room seats the creator as host with a valid room code', async ({ page }) => {
    await createRoom(page, 'Ada')

    const code = await roomCodeOf(page)
    expect(code).toMatch(ROOM_CODE_PATTERN)

    const names = await seatNameTexts(page)
    expect(names).toEqual(['Ada (host)', 'Open', 'Open', 'Open'])
  })

  test('a second player joining by code is seated and visible to the first player', async ({ page, context }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(page2.getByTestId('seat-0')).toBeVisible()

    await expect(seatRows(page).nth(1).locator('.seat-name')).toHaveText('Bob')
  })

  test('joining an unknown code is rejected without seating the player', async ({ page }) => {
    // Guaranteed never to exist: the real code alphabet excludes 0/1/I/O entirely.
    await joinRoomByCode(page, 'I0O1', 'Eve')

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByTestId('seat-0')).toHaveCount(0)
  })

  test('joining a full room is rejected', async ({ page, context }) => {
    await createRoom(page, 'Ada', 'vsBots') // host + 3 bots = already full
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Zoe')

    await expect(page2.getByRole('alert')).toBeVisible()
    await expect(page2.getByTestId('seat-0')).toHaveCount(0)
  })
})

test.describe('seats: bots and host control', () => {
  test('the host can convert an open seat to a bot and back', async ({ page }) => {
    await createRoom(page, 'Ada')
    const seat2 = seatRows(page).nth(1)
    await expect(seat2.locator('.seat-name')).toHaveText('Open')

    await seat2.getByRole('button', { name: 'Fill with bot' }).click()
    await expect(seat2.locator('.seat-name')).toHaveText('Bot')

    await seat2.getByRole('button', { name: 'Open seat' }).click()
    await expect(seat2.locator('.seat-name')).toHaveText('Open')
  })

  test('a non-host player cannot toggle seats', async ({ page, context }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    // LobbyScreen only renders toggle buttons for the host - a non-host has no way to invoke one.
    await expect(page2.getByRole('button', { name: /Fill with bot|Open seat/ })).toHaveCount(0)
  })

  test('Play vs 3 bots seats the creator as host and fills the rest with bots', async ({ page }) => {
    await createRoom(page, 'Ada', 'vsBots')
    const names = await seatNameTexts(page)
    expect(names).toEqual(['Ada (host)', 'Bot', 'Bot', 'Bot'])
  })
})

test.describe('identity, reconnection, and disconnection', () => {
  test('refreshing the page reclaims the same seat', async ({ page, context }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    await page2.reload()

    await expect(page2.getByTestId('seat-0')).toBeVisible()
    const names = await seatNameTexts(page2)
    expect(names).toEqual(['Ada (host)', 'Bob', 'Open', 'Open'])
  })

  test('an unknown session token falls back to a normal new join', async ({ page, context }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await seedIdentity(page2, { name: 'Casper', roomCode: code, playerToken: 'does-not-exist' })
    await page2.goto('/')

    await expect(page2.getByTestId('seat-0')).toBeVisible()
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Casper')
  })

  test('closing a tab marks that seat disconnected without freeing it', async ({ page, context }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    await page2.close()

    await expect(seatRows(page).nth(1).locator('.seat-name')).toHaveText('Bob (disconnected)')
    await expect(seatRows(page)).toHaveCount(4)
  })
})

test.describe('leaving and host reassignment', () => {
  test('leaving a room frees the seat', async ({ page, context }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    await page2.getByRole('button', { name: 'Leave room' }).click()

    await expect(seatRows(page).nth(1).locator('.seat-name')).toHaveText('Open')
    await expect(page2.getByTestId('display-name')).toBeVisible()
  })

  test('host status passes to another connected human when the host leaves', async ({ page, context }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    await page.getByRole('button', { name: 'Leave room' }).click()

    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob (host)')

    // Prove host authority actually transferred (not just a label) by having Bob toggle a seat.
    await seatRows(page2).nth(2).getByRole('button', { name: 'Fill with bot' }).click()
    await expect(seatRows(page2).nth(2).locator('.seat-name')).toHaveText('Bot')
  })

  test('the room has no host until a human rejoins an otherwise bot-only room', async ({ page, context }) => {
    await createRoom(page, 'Ada', 'vsBots')
    const code = await roomCodeOf(page)

    await page.getByRole('button', { name: 'Leave room' }).click()
    await expect(page.getByTestId('display-name')).toBeVisible()

    // If the room's host slot hadn't actually been cleared to "no host" server-side, this new
    // player would not become host on joining - RoomActor only assigns a host when none exists.
    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Zoe')
    await expect(seatRows(page2).first().locator('.seat-name')).toHaveText('Zoe (host)')
  })
})
