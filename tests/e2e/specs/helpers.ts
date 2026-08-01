import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

// Matches RoomCodeGenerator's alphabet exactly: no 0/1/I/O (misread when read aloud).
export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/

export async function goToLanding(page: Page): Promise<void> {
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
