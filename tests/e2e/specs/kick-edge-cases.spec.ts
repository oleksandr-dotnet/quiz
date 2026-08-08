import { expect, test, type Page } from '@playwright/test'
import {
  clickFirstEligibleRegion,
  createRoom,
  fastForwardToBattle,
  fastForwardUntil,
  joinRoomByCode,
  ownedRegionIds,
  regionOwnerSeatOf,
  roomCodeOf,
  seatRows,
  seedIdentity,
  setLobbySettings,
  startGameAndReachBaseSelection,
} from './helpers'

// This file extends kick-player.spec.ts's three baseline scenarios (lobby kick, mid-game bot
// takeover, mid-game territory release) with the edge cases host-kick-player's spec calls out by
// name: stale-session rejoin attempts under every phase/disposition, who gets a kick affordance at
// all, and whether a kick landing on the current turn-holder actually reroutes the game immediately
// instead of just eventually timing out the same as it always would have. kick-player.spec.ts is
// read for technique only - never imported or modified, and none of its three scenarios are repeated
// here.

async function currentSession(page: Page): Promise<{ roomCode: string; playerToken: string }> {
  const raw = await page.evaluate(() => window.sessionStorage.getItem('triviador.session'))
  if (!raw) throw new Error('Expected a session to be stored on this page, found none.')
  return JSON.parse(raw) as { roomCode: string; playerToken: string }
}

async function openKickMenuFor(page: Page, seatIndex: number): Promise<void> {
  await page.getByTestId(`player-card-${seatIndex}`).click()
  await expect(page.getByTestId('player-action-menu')).toBeVisible()
  await page.getByTestId('player-action-kick').click()
}

/**
 * A 4-seat room (Ada host, Bob, two bots) driven to land grab's first shared Question - the same
 * low-timing-risk point kick-player.spec.ts's own setup targets. All four seats end up occupied on
 * purpose: the stale-session scenarios below depend on there being no open seat left for an old
 * token to fall into.
 */
async function setupFourSeatGameAtLandGrab(
  page: Page,
  context: import('@playwright/test').BrowserContext,
): Promise<{ page2: Page }> {
  await createRoom(page, 'Ada')
  const code = await roomCodeOf(page)

  const page2 = await context.newPage()
  await joinRoomByCode(page2, code, 'Bob')
  await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

  await seatRows(page).nth(2).getByRole('button', { name: 'Fill with bot' }).click()
  await seatRows(page).nth(3).getByRole('button', { name: 'Fill with bot' }).click()

  await setLobbySettings(page, { answerStreaks: false, categoryBanDraft: false, goldenQuestion: false })
  await startGameAndReachBaseSelection([page, page2])

  await clickFirstEligibleRegion(page)
  await expect(page2.locator('.turn-banner')).toHaveText(
    'Your turn - click a highlighted territory to claim it as your base',
  )
  await clickFirstEligibleRegion(page2)

  // The two bot seats pick their own bases independently in the background (BotChoice, up to 6s
  // each, sequential since base picks are one-at-a-time) before land grab can start.
  await expect(page.getByTestId('land-grab-dock')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('question-card')).toBeVisible()

  return { page2 }
}

test.describe('host-kick-player edge cases', () => {
  test.setTimeout(120_000)

  test('a kicked player who rejoins the lobby is seated as a brand new player, never reclaiming their old seat', async ({
    page,
    context,
  }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    const staleSession = await currentSession(page2)

    await page.getByTestId('kick-seat-1').click()
    await expect(page.getByTestId('kick-confirm')).toBeVisible()
    await page.getByTestId('kick-confirm').click()

    await expect(page2.getByTestId('kicked-badge')).toBeVisible()
    await expect(seatRows(page).nth(1).locator('.seat-name')).toHaveText('Open')

    // A real browser wouldn't purge the token from storage just because the tab it lived in got
    // redirected - seeding a fresh tab with that exact stale roomCode/playerToken pair is the
    // honest way to simulate Bob trying it again, distinct from kick-player.spec.ts's own re-join
    // test (which uses a brand new stranger, never the kicked player's own former token). A
    // different display name than before makes a silent reclaim (which would keep showing "Bob")
    // observably different from a genuine fresh join.
    const page3 = await context.newPage()
    await seedIdentity(page3, { name: 'Bob Again', roomCode: staleSession.roomCode, playerToken: staleSession.playerToken })
    await page3.goto('/')

    // seat.Clear() wiped the seat's PlayerToken along with everything else, so
    // RoomActor.HandleJoinAsync's token lookup finds nothing and falls through to its "normal new
    // join" path - the stale token grants nothing, it just happens that seat 1 is the only seat
    // open again.
    await expect(seatRows(page3).nth(1).locator('.seat-name')).toHaveText('Bob Again')
    await expect(seatRows(page).nth(1).locator('.seat-name')).toHaveText('Bob Again')
  })

  test('a kicked player mid-game with bot takeover cannot rejoin using their old session', async ({ page, context }) => {
    const { page2 } = await setupFourSeatGameAtLandGrab(page, context)
    const staleSession = await currentSession(page2)

    await openKickMenuFor(page, 1)
    await expect(page.getByTestId('kick-bot-takeover')).toBeVisible()
    await page.getByTestId('kick-bot-takeover').click()
    await expect(page2.getByTestId('kicked-badge')).toBeVisible()

    const page3 = await context.newPage()
    await seedIdentity(page3, { name: 'Bob Returns', roomCode: staleSession.roomCode, playerToken: staleSession.playerToken })
    await page3.goto('/')

    // Every seat is bound now: Ada and the two bots hold theirs permanently, and Bob's own seat
    // still carries his PlayerId even though bot takeover cleared his token and connection
    // (RoomActor Decision D5 - a mid-game seat's PlayerId never clears, so IsOpen never becomes true
    // again). With nowhere open to land, the stale token buys a RoomFull rejection - back to the
    // landing screen empty-handed, not a reclaimed seat.
    await expect(page3.getByTestId('display-name')).toBeVisible({ timeout: 15_000 })
  })

  test('a kicked player mid-game with territory release cannot rejoin using their old session', async ({ page, context }) => {
    const { page2 } = await setupFourSeatGameAtLandGrab(page, context)
    const staleSession = await currentSession(page2)

    await openKickMenuFor(page, 1)
    await expect(page.getByTestId('kick-release-land')).toBeVisible()
    await page.getByTestId('kick-release-land').click()
    await expect(page2.getByTestId('kicked-badge')).toBeVisible()

    const page3 = await context.newPage()
    await seedIdentity(page3, { name: 'Bob Returns', roomCode: staleSession.roomCode, playerToken: staleSession.playerToken })
    await page3.goto('/')

    // Territory release also nulls the token but keeps Seat.PlayerId bound (the withdrawn player
    // must never be newly joinable, matching JoinGame's Lobby-only invariant) - same RoomFull
    // rejection as the bot-takeover disposition above.
    await expect(page3.getByTestId('display-name')).toBeVisible({ timeout: 15_000 })
  })

  test('a non-host has no kick affordance at all, and the host has none on their own seat', async ({ page, context }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    // The host sees a kick control on Bob's seat but never on her own (LobbyScreen's own
    // `!seat.isHost` guard).
    await expect(page.getByTestId('kick-seat-1')).toBeVisible()
    await expect(page.getByTestId('kick-seat-0')).toHaveCount(0)

    // Bob (not the host) sees no kick control anywhere - the whole button is gated behind
    // `view.youAreHost`, not merely disabled.
    await expect(page2.getByTestId('kick-seat-0')).toHaveCount(0)
    await expect(page2.getByTestId('kick-seat-1')).toHaveCount(0)
  })

  test('kicking the current base-picker advances base selection immediately instead of waiting out their deadline', async ({
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

    // Ada picks first (seat order) - Bob is now the current base-picker (BasePickDurationSeconds =
    // 15s), and with only two players, he's also the last one left to pick.
    await clickFirstEligibleRegion(page)
    await expect(page2.locator('.turn-banner')).toHaveText(
      'Your turn - click a highlighted territory to claim it as your base',
    )

    await openKickMenuFor(page, 1)
    await expect(page.getByTestId('kick-release-land')).toBeVisible()
    await page.getByTestId('kick-release-land').click()
    await expect(page2.getByTestId('kicked-badge')).toBeVisible()

    // GameEngine.Withdrawal's reroute (RerouteAfterWithdrawal -> AdvanceBasePickPast) completes
    // base selection and starts land grab synchronously, inside the very same command that
    // processed the kick - there is no bot "thinking delay" involved in this reroute at all (unlike
    // a bot-takeover kick). A 5s bound is generous padding over normal network/render latency and
    // still nowhere near the 15s deadline this would take if withdrawal weren't actively rerouted.
    await expect(page.getByTestId('land-grab-dock')).toBeVisible({ timeout: 5_000 })
  })

  test('kicking the current attacker mid-Battle advances the turn immediately and releases their land to nobody', async ({
    page,
    context,
  }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')
    await seatRows(page).nth(2).getByRole('button', { name: 'Fill with bot' }).click()

    await setLobbySettings(page, { answerStreaks: false, categoryBanDraft: false, goldenQuestion: false })
    await startGameAndReachBaseSelection([page, page2])

    await clickFirstEligibleRegion(page)
    await expect(page2.locator('.turn-banner')).toHaveText(
      'Your turn - click a highlighted territory to claim it as your base',
    )
    await clickFirstEligibleRegion(page2)

    await expect(page.getByTestId('land-grab-dock')).toBeVisible({ timeout: 60_000 })
    await fastForwardToBattle(page, page2)
    await expect(page.getByTestId('battle-dock')).toBeVisible()

    // Three active participants (Ada, Bob, one bot) round-robin in seat order every round. Drive
    // arbitrary turns - Ada's own, and the bot's (which resolves on its own via RoomActor's bot
    // scheduling) - until specifically Bob's turn to pick an attack target comes up: the only moment
    // a selectable region shows on his own page, since land grab is already behind us.
    await fastForwardUntil(
      page,
      page2,
      async () => page2.locator('g.region.selectable').first().isVisible().catch(() => false),
      90_000,
    )

    const bobRegionsBeforeKick = await ownedRegionIds(page, 1)
    expect(bobRegionsBeforeKick.length).toBeGreaterThan(0)

    await openKickMenuFor(page, 1)
    await expect(page.getByTestId('kick-release-land')).toBeVisible()
    await page.getByTestId('kick-release-land').click()
    await expect(page2.getByTestId('kicked-badge')).toBeVisible()

    // WithdrawPlayer's reroute (RerouteAfterWithdrawal -> AdvanceTurn) dequeues whoever's next in
    // this same round's queue immediately, inside the same command - no bot "thinking delay" is
    // involved in the reroute itself. AttackTargetSelectionDurationSeconds is 15s; this bound stays
    // far under it.
    await expect(page.locator('.turn-banner')).not.toContainText('Bob', { timeout: 5_000 })

    // Every region Bob held becomes neutral - not Ada's, not the bot's. Read immediately, before any
    // unrelated ordinary battle turn has a chance to change ownership for reasons that have nothing
    // to do with this kick.
    const adaRegionsAfterKick = await ownedRegionIds(page, 0)
    const botRegionsAfterKick = await ownedRegionIds(page, 2)
    for (const regionId of bobRegionsBeforeKick) {
      expect(await regionOwnerSeatOf(page, regionId)).toBeNull()
      expect(adaRegionsAfterKick).not.toContain(regionId)
      expect(botRegionsAfterKick).not.toContain(regionId)
    }
  })

  test("the kicked player's message is distinct from a room-closed message", async ({ page, context }) => {
    await createRoom(page, 'Ada')
    const code = await roomCodeOf(page)

    const page2 = await context.newPage()
    await joinRoomByCode(page2, code, 'Bob')
    await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')

    await page.getByTestId('kick-seat-1').click()
    await expect(page.getByTestId('kick-confirm')).toBeVisible()
    await page.getByTestId('kick-confirm').click()

    const kickedBadge = page2.getByTestId('kicked-badge')
    await expect(kickedBadge).toBeVisible()
    await expect(kickedBadge).toHaveText('You were kicked from the room by the host.')

    // ConnectionBadge.tsx checks kickedReason before status === 'closed' and renders them as
    // different testids with entirely different copy (kick.youWereKicked vs.
    // connection.roomClosed[WithReason]) - a kicked player must never also carry (or be
    // indistinguishable from) the generic room-closed banner. Real room closure is a 15-minute idle
    // sweep (RoomOptions.IdleThreshold, hardcoded in Program.cs) that this suite deliberately doesn't
    // drive live (see TEST-PLAN.md's exclusions) - this asserts the two code paths never overlap in
    // the DOM, which is the observable half of "distinct" reachable without a 15-minute wait.
    await expect(page2.getByTestId('connection-badge')).toHaveCount(0)
    expect(await kickedBadge.textContent()).not.toBe('Room closed')
  })
})
