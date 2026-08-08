import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import {
  clickFirstEligibleRegion,
  createRoom,
  joinRoomByCode,
  ownedRegionIds,
  regionOwnerSeatOf,
  roomCodeOf,
  seatRows,
  setLobbySettings,
  startGameAndReachBaseSelection,
} from './helpers'

// Coverage: openspec/specs/base-selection-flow/spec.md (plan section 2.4). A two-player, no-bot
// game - GameRules.MinPlayers's floor, per e2e-test-tooling's "smallest game that still reaches
// it" - with all three add-streak-ban-golden-mechanics off, since category-ban-draft defaults ON
// and would otherwise land StartGame in the CategoryBan phase instead of BaseSelection.

const here = path.dirname(fileURLToPath(import.meta.url))
const mapPath = path.resolve(here, '..', '..', '..', 'src', 'UI', 'Triviador.Web', 'Data', 'map.json')

interface MapRegionJson {
  id: string
  adjacentTo: string[]
}

// Read straight off the same map content the server loads from disk (see
// Triviador.Infrastructure's MapRepository) - needed to independently verify the
// MinimumBaseDistance rule's effect on the eligible-region set without re-implementing the
// engine's own hop-distance search inside the test.
const mapRegions: MapRegionJson[] = JSON.parse(readFileSync(mapPath, 'utf8')).regions
const directNeighborsOf = new Map(mapRegions.map((r) => [r.id, r.adjacentTo]))

/** Creates a two-human room with all three optional mechanics off, so StartGame goes straight to base selection. */
async function setUpTwoHumanRoom(page: Page, context: BrowserContext): Promise<Page> {
  await createRoom(page, 'Ada')
  const code = await roomCodeOf(page)
  const page2 = await context.newPage()
  await joinRoomByCode(page2, code, 'Bob')
  await expect(seatRows(page2).nth(1).locator('.seat-name')).toHaveText('Bob')
  await setLobbySettings(page, { answerStreaks: false, categoryBanDraft: false, goldenQuestion: false })
  return page2
}

/**
 * Every region id currently highlighted as eligible on this page - independent of whether this
 * viewer happens to be the current picker. RegionShape (components/map/RegionShape.tsx) renders
 * the dashed "marching-ants" eligibility outline off the `eligible` prop alone; only the outer
 * `region selectable` class (and the click handler) additionally requires `interactive`. This is
 * what lets a spectating viewer's eligible set be compared against the current picker's own.
 */
async function eligibleRegionIdsOnPage(page: Page): Promise<string[]> {
  const testIds = await page
    .locator('g.region')
    .evaluateAll((elements) =>
      elements.filter((el) => el.querySelector('.marching-ants')).map((el) => el.getAttribute('data-testid')),
    )
  return testIds.filter((id): id is string => id !== null).map((id) => id.replace('region-', ''))
}

test.describe('base selection', () => {
  test('happy path: seat-order picking flows straight into the first land-grab question', async ({ page, context }) => {
    const page2 = await setUpTwoHumanRoom(page, context)
    await startGameAndReachBaseSelection([page, page2])

    // GameEngine.Lobby.cs starts base selection at Players[0] - Ada (seat 0, the host) always
    // picks first.
    await expect(page.locator('.turn-banner')).toContainText(/Your turn/)
    await expect(page2.locator('.turn-banner')).toContainText(/Waiting for Ada/)

    const adaBase = await clickFirstEligibleRegion(page)
    if (!adaBase) throw new Error('expected an eligible region to be offered to Ada')

    await expect(page2.locator('.turn-banner')).toContainText(/Your turn/)
    await expect(page.locator('.turn-banner')).toContainText(/Waiting for Bob/)

    const bobBase = await clickFirstEligibleRegion(page2)
    if (!bobBase) throw new Error('expected an eligible region to be offered to Bob')

    // The engine emits BaseSelectionCompleted and the first QuestionAsked in the same
    // Execute-then-pump batch (see CLAUDE.md's command/event cycle) - RoomActor never broadcasts
    // an intermediate "base selection is done but land grab hasn't started" snapshot, so there is
    // no dead state to race here; these assertions are the whole story.
    await expect(page.getByTestId('base-selection-dock')).toHaveCount(0)
    await expect(page.getByTestId('land-grab-dock')).toBeVisible()
    await expect(page.getByTestId('question-card')).toBeVisible()
    await expect(page2.getByTestId('question-card')).toBeVisible()

    expect(await regionOwnerSeatOf(page, adaBase)).toBe(0)
    expect(await regionOwnerSeatOf(page, bobBase)).toBe(1)
    expect(adaBase).not.toBe(bobBase)
  })

  test('a player who is not the current picker has no selectable region and cannot claim one', async ({ page, context }) => {
    const page2 = await setUpTwoHumanRoom(page, context)
    await startGameAndReachBaseSelection([page, page2])

    await expect(page.locator('.turn-banner')).toContainText(/Your turn/)
    await expect(page2.locator('.turn-banner')).toContainText(/Waiting for Ada/)
    await expect(page2.locator('g.region.selectable')).toHaveCount(0)

    // Force a click on an unowned region anyway, bypassing Playwright's normal actionability check
    // (which would otherwise refuse to click a non-interactive element). RegionShape wires no
    // onClick handler at all when the region isn't both interactive and eligible for this viewer,
    // so the click is a genuine no-op client-side, and a stray SelectBase would be rejected
    // server-side (NotYourTurn) even if it somehow fired.
    await page2.getByTestId('region-r05').click({ force: true })
    await page2.waitForTimeout(500)
    expect(await regionOwnerSeatOf(page2, 'r05')).toBeNull()
    await expect(page.locator('.turn-banner')).toContainText(/Your turn/)
  })

  test('the minimum-distance rule excludes a taken base and its neighbors from the next pick', async ({ page, context }) => {
    const page2 = await setUpTwoHumanRoom(page, context)
    await startGameAndReachBaseSelection([page, page2])

    const takenBase = await clickFirstEligibleRegion(page)
    if (!takenBase) throw new Error('expected an eligible region to be offered to the first picker')

    // Wait for the turn to actually pass before reading Bob's eligible set.
    await expect(page2.locator('.turn-banner')).toContainText(/Your turn/)

    const eligibleForBob = await eligibleRegionIdsOnPage(page2)
    expect(eligibleForBob).not.toContain(takenBase)
    for (const neighborId of directNeighborsOf.get(takenBase) ?? []) {
      expect(eligibleForBob).not.toContain(neighborId)
    }
    // Sanity: the rule doesn't degenerate into excluding everything - GameRules.MinimumBaseDistance
    // is 2 on an 18-region map, so plenty of free regions remain far enough away from the one base
    // taken so far.
    expect(eligibleForBob.length).toBeGreaterThan(0)
  })

  test('every viewer sees the same eligible region set and the same whose-turn information', async ({ page, context }) => {
    const page2 = await setUpTwoHumanRoom(page, context)
    await startGameAndReachBaseSelection([page, page2])

    await clickFirstEligibleRegion(page)
    await expect(page2.locator('.turn-banner')).toContainText(/Your turn/)

    // Nothing about base selection is secret: pendingBasePick.eligibleRegionIds is computed once
    // server-side and broadcast identically to every viewer (RoomActor.BuildGameView), regardless
    // of who is actually allowed to click right now.
    const eligibleOnSpectatorPage = (await eligibleRegionIdsOnPage(page)).sort()
    const eligibleOnCurrentPickerPage = (await eligibleRegionIdsOnPage(page2)).sort()
    expect(eligibleOnSpectatorPage).toEqual(eligibleOnCurrentPickerPage)

    // And both pages agree on who's picking, from opposite sides of the turn.
    await expect(page.locator('.turn-banner')).toContainText(/Waiting for Bob/)
    await expect(page2.locator('.turn-banner')).toContainText(/Your turn/)
  })

  test('tricky: an unresponsive picker gets a base auto-picked on the deadline, and the game still ends with one distinct base per player', async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000)
    const page2 = await setUpTwoHumanRoom(page, context)
    await startGameAndReachBaseSelection([page, page2])

    // Ada (the first picker) never acts. GameRules.BasePickDurationSeconds is 15s - poll well past
    // that for the turn to pass on its own via TimeoutElapsed -> PickAutoBaseRegion.
    await expect
      .poll(async () => (await page2.locator('.turn-banner').textContent()) ?? '', {
        timeout: 25_000,
        message: 'the turn should pass to Bob once the deadline auto-picks a base for Ada',
      })
      .toMatch(/Your turn/)

    expect((await ownedRegionIds(page, 0)).length).toBe(1)

    // Finish the phase normally so the "each player ends up with exactly one distinct base" claim
    // is actually checkable, rather than also waiting out Bob's own 15s deadline.
    const bobsBase = await clickFirstEligibleRegion(page2)
    if (!bobsBase) throw new Error('expected an eligible region to be offered to Bob')

    await expect(page.getByTestId('land-grab-dock')).toBeVisible()
    const adaBases = await ownedRegionIds(page, 0)
    const bobBases = await ownedRegionIds(page, 1)
    expect(adaBases.length).toBe(1)
    expect(bobBases.length).toBe(1)
    expect(adaBases[0]).not.toBe(bobBases[0])
  })
})
