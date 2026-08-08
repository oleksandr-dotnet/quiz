import { expect, test, type Page } from '@playwright/test'
import {
  answerAnyIfAsked,
  clickFirstEligibleRegion,
  createRoom,
  joinRoomByCode,
  roomCodeOf,
  seatRows,
  seedIdentity,
  setLobbySettings,
  startGameAndReachBaseSelection,
} from './helpers'

// player-leave-and-takeover's whole point is a distinction that's invisible in the DOM as a label -
// there is no "this seat is a bot" badge anywhere once a human seat converts (PlayerRoster keeps
// showing the same display name; RoomActor never even resets it). The only honest way to prove a
// seat has gone bot-controlled vs. merely disconnected is behavioral: BotChoice.ThinkingDelay caps
// every bot submission at 6s (never anywhere near GameRules' 10-20s question/pick deadlines), so a
// pending activity resolving inside ~8s is a bot, and one that only resolves after the real deadline
// is the ordinary timeout fallback. Every test below leans on that timing gap rather than inventing
// a new data-testid for something the product deliberately keeps invisible to players.
//
// kick-player.spec.ts is read for technique only (never imported/modified) - it exercises the same
// bot-takeover/territory-release mechanics from the *kick* side; this file is the *leave* side.

async function leaveGameViaMenu(page: Page): Promise<void> {
  // The desktop top bar's leave button has no data-testid of its own (LeaveGameConfirmModal's
  // testids cover the modal only) - .leave-game-button is unambiguous and stable, and this suite's
  // default Desktop Chrome viewport always renders it (App.css only swaps to the mobile
  // app-menu-button path below 901px, which this file's default viewport never crosses).
  await page.locator('.leave-game-button').click()
  await expect(page.getByTestId('leave-game-confirm')).toBeVisible()
  await page.getByTestId('leave-game-confirm').click()
  // onConfirmLeaveGame awaits leaveRoom() before clearing local session state, so waiting for the
  // landing screen to reappear is a reliable sync point proving the server has already processed
  // HandleLeaveAsync - a later assertion timed from here isn't racing that round trip.
  await expect(page.getByTestId('display-name')).toBeVisible()
}

async function currentSession(page: Page): Promise<{ roomCode: string; playerToken: string }> {
  const raw = await page.evaluate(() => window.sessionStorage.getItem('triviador.session'))
  if (!raw) throw new Error('Expected a session to be stored on this page, found none.')
  return JSON.parse(raw) as { roomCode: string; playerToken: string }
}

/**
 * Two human seats (no bots - GameRules.MinPlayers, per e2e-test-tooling's "smallest game" rule),
 * pinned to deterministic scoring, driven to land grab's very first Question - a window shared by
 * both participants (not a tight per-player deadline), the same low-timing-risk point
 * kick-player.spec.ts's own setup targets for the identical reason.
 */
async function setupTwoPlayerGameAtLandGrab(page: Page, context: import('@playwright/test').BrowserContext): Promise<Page> {
  await createRoom(page, 'Ada')
  const code = await roomCodeOf(page)

  const page2 = await context.newPage()
  await joinRoomByCode(page2, code, 'Bob')
  await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

  await setLobbySettings(page, { answerStreaks: false, categoryBanDraft: false, goldenQuestion: false })
  await startGameAndReachBaseSelection([page, page2])

  await clickFirstEligibleRegion(page)
  await expect(page2.locator('.turn-banner')).toHaveText(
    'Your turn - click a highlighted territory to claim it as your base',
  )
  await clickFirstEligibleRegion(page2)

  await expect(page.getByTestId('land-grab-dock')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('question-card')).toBeVisible()

  return page2
}

test.describe('player leave and takeover', () => {
  test.setTimeout(90_000)

  test('an explicit mid-game leave hands the seat to bot control and the game keeps moving through it', async ({
    page,
    context,
  }) => {
    const page2 = await setupTwoPlayerGameAtLandGrab(page, context)

    await leaveGameViaMenu(page2)

    // Bob's seat is bot-controlled the instant HandleLeaveAsync lands - it answers the already-
    // pending land-grab question on its own (BotChoice caps thinking time at 6s), so Ada's own
    // answer is all that's left to unblock resolution.
    await answerAnyIfAsked(page)

    // ChoiceQuestionDurationSeconds/TipQuestionDurationSeconds are 12s/20s - a reveal inside 8s can
    // only be BotChoice's human-paced guess, never the timeout fallback picking up the slack.
    await expect(page.getByTestId('reveal-overlay')).toBeVisible({ timeout: 8_000 })

    // Bob's seat is still an active participant (score/turns), just bot-controlled now - never
    // eliminated or withdrawn, matching player-leave-and-takeover's "seat remains occupied by the
    // same player identity" guarantee.
    const bobCard = page.getByTestId('player-card-1')
    await expect(bobCard).not.toHaveClass(/eliminated/)
    await expect(bobCard).not.toHaveClass(/withdrawn/)
  })

  test('rejoining after leaving does not restore human control', async ({ page, context }) => {
    const page2 = await setupTwoPlayerGameAtLandGrab(page, context)
    const staleSession = await currentSession(page2)

    await leaveGameViaMenu(page2)

    // A voluntary leave (unlike a kick) never invalidates the token - HandleLeaveAsync's mid-game
    // branch only clears ConnectionId - so this really is Bob's own still-valid session, exactly as
    // it would be if he still had this room open in another tab on his own machine. Reconnecting
    // before the still-pending question resolves means the very same pending activity Bob was a
    // named participant of is the one under observation below.
    const page3 = await context.newPage()
    await seedIdentity(page3, { name: 'Bob', roomCode: staleSession.roomCode, playerToken: staleSession.playerToken })
    await page3.goto('/')

    // The token is recognized (JoinAsync's token-match path finds the seat), so this is a genuine
    // reclaim of Bob's identity, not a fresh join - the client renders the live game for him.
    await expect(page3.getByTestId('land-grab-dock')).toBeVisible({ timeout: 15_000 })
    await expect(page3.getByTestId('kicked-badge')).toHaveCount(0)

    // The reconnect changed nothing about how the seat is driven: seat.IsBot was never reset by the
    // reconnect, so without page3 ever acting, the still-pending question resolves at the same bot
    // pace as before - proof it doesn't "revert to awaiting their input" just because their
    // identifier is live again.
    await answerAnyIfAsked(page)
    await expect(page.getByTestId('reveal-overlay')).toBeVisible({ timeout: 8_000 })

    const bobCard = page.getByTestId('player-card-1')
    await expect(bobCard).not.toHaveClass(/eliminated/)
    await expect(bobCard).not.toHaveClass(/withdrawn/)
  })

  test('a dropped connection alone does not trigger bot takeover - the seat waits out its own deadline', async ({
    page,
    context,
  }) => {
    const page2 = await setupTwoPlayerGameAtLandGrab(page, context)

    // An abrupt tab close, not a leave - RoomActor.HandleConnectionLostAsync only clears
    // ConnectionId, never seat.IsBot.
    await page2.close()

    // Answering here (rather than after the disconnected check) is deliberate, not just sequencing:
    // it guarantees a fresh GameView broadcast that necessarily recomputes every player's
    // isConnected from current seat state (BuildGameView does this on every call, unconditionally),
    // so the assertion below is never racing how promptly the room happens to broadcast off of the
    // disconnect notification itself - only whether Bob's seat is correctly reported disconnected at
    // all, which is the actual claim under test.
    await answerAnyIfAsked(page)

    const bobCard = page.getByTestId('player-card-1')
    await expect(bobCard).toHaveClass(/disconnected/, { timeout: 10_000 })
    await expect(bobCard).not.toHaveClass(/withdrawn/)

    // Give a bot answer's entire possible window (BotChoice.MaxDelay=6s, plus generous buffer) a
    // chance to have fired if this seat were wrongly bot-controlled - it isn't, so nothing should
    // have submitted on Bob's behalf and the question must still be sitting unresolved.
    await page.waitForTimeout(9_000)
    await expect(page.getByTestId('reveal-overlay')).toBeHidden()

    // Only the question's own deadline resolves it from here on - the ordinary TimeoutElapsed
    // fallback that room-lobby's disconnection behavior already promises, never a bot standing in.
    await expect(page.getByTestId('reveal-overlay')).toBeVisible({ timeout: 15_000 })
  })

  test('leaving in the lobby still just frees the seat - no bot takeover', async ({ page, context }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    await page2.getByRole('button', { name: 'Leave room' }).click()

    await expect(seatRows(page).nth(1).locator('.seat-name')).toHaveText('Open')
    // A freed lobby seat is a plain open seat, not a bot - the host still has to explicitly fill it,
    // exactly as if nobody had ever joined seat 1.
    await expect(seatRows(page).nth(1).getByRole('button', { name: 'Fill with bot' })).toBeVisible()
  })

  test('leaving while it is your own turn still gets a timely bot move rather than waiting out the deadline', async ({
    page,
    context,
  }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    await setLobbySettings(page, { answerStreaks: false, categoryBanDraft: false, goldenQuestion: false })
    await startGameAndReachBaseSelection([page, page2])

    // Ada picks first (seat order), which hands the currently-pending BasePick activity to Bob -
    // exactly the "it is your own turn right now" case the third player-leave-and-takeover
    // requirement is about, as opposed to a shared land-grab Question with several participants.
    await clickFirstEligibleRegion(page)
    await expect(page2.locator('.turn-banner')).toHaveText(
      'Your turn - click a highlighted territory to claim it as your base',
    )

    await leaveGameViaMenu(page2)

    // HandleLeaveAsync schedules a bot move for the CURRENT pending activity the instant it converts
    // the seat (GameEngine.State.Pending is already Bob's BasePick) - it doesn't wait for a fresh
    // activity to be issued first. With only Ada and Bob in this game, Bob's bot-picked base is also
    // the last one needed, so land grab starts the moment he picks. BasePickDurationSeconds is 15s;
    // a human-paced bot pick (<=6s) plus a phase transition lands comfortably inside 10s.
    await expect(page.getByTestId('land-grab-dock')).toBeVisible({ timeout: 10_000 })
  })
})
