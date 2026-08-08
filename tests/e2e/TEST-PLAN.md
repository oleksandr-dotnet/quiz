# Triviador E2E Test Plan

Scope: automated end-to-end coverage of **business logic** — every capability in `openspec/specs/`
plus the three in-flight mechanics in `openspec/changes/add-streak-ban-golden-mechanics/specs/`
(answer streaks, category-ban draft, golden questions) and `duel-defense-score-bonus`.

Everything runs through the real browser against the real `Triviador.Web` + `Triviador.Client`
(`tests/e2e/playwright.config.ts`), per `openspec/specs/e2e-test-tooling/spec.md`. No mocks, no
component-level renders, no direct hub calls.

---

## 0. Baseline (before this plan)

`npx playwright test` → **14 passed, 4 failed**. All four failures share one root cause: the
category-ban draft now defaults to **on** (`GameRules.EnableCategoryBanDraft = true`), so `StartGame`
lands in the `CategoryBan` phase, and every helper that expects `base-selection-dock` immediately
after clicking `start-game` times out.

Secondary hazard the same defaults introduce: **answer streaks** (`+50 × streak`) and **golden
questions** (doubling) perturb every score-delta assertion. Score-sensitive tests must pin the
lobby settings explicitly rather than inherit defaults.

---

## 1. Shared harness (lands first — everything else depends on it)

`specs/helpers.ts` and `specs/question-bank.ts`, owned by a single agent, no parallel edits.

| Helper | Purpose |
| --- | --- |
| `passCategoryBanIfPresent(page)` | Submit an empty proposal if the ban card is up; dismiss the result popup. Idempotent no-op otherwise. |
| `setLobbySettings(page, {answerStreaks?, categoryBanDraft?, goldenQuestion?})` | Host-only checkbox setter; waits for the projected value to settle so it is fixed before `StartGame`. |
| `startGameAndReachBaseSelection(pages[])` | Click start, walk every page past `CategoryBan` if enabled, assert `base-selection-dock`. |
| `setUpTwoPlayerBattle(page, context, opts)` | Existing helper, extended: defaults to **streaks/golden/ban all off** for deterministic scoring; `opts` re-enables per test. |
| `readScore(page, seat)` | Settled score read (past the `Odometer` ~320 ms animation). |
| `answerCorrectly(page)` / `answerIncorrectly(page)` | Content-bank-backed answers for both Choice and Tip cards — currently duplicated inline in two battle specs. |
| `regionOwnerSeatOf(page, regionId)` / `ownedRegionIds(page, seat)` | Ownership reads off the map for territory-transfer assertions. |
| `categoryOfPrompt(promptText)` (question-bank) | Prompt → category (the bank is sharded one file per category), needed to prove banned categories never appear. |

Harness agent also fixes the 4 red tests, then proves **18/18 green** before wave 2 starts.

---

## 2. Scenario coverage

Legend: **H** = happy path / main flow, **E** = edge case, **T** = tricky/adversarial.

### 2.1 `room-lobby-extended.spec.ts` — room & seat lifecycle
Capability: `room-lobby`. (The existing `room-lobby.spec.ts` already covers create/join/full/unknown
code/bot toggle/refresh-reclaim/disconnect/leave/host-reassign — this file adds what is missing.)

1. **H** Four humans fill the room; the 5th join is rejected as full (today only the bot-filled case is covered).
2. **E** Host cannot toggle a seat held by a connected human (no toggle affordance on that row).
3. **E** `StartGame` is unavailable with a single occupied seat, and becomes available the instant a second seat fills.
4. **E** Deep link `#/room/<CODE>` seats a joiner directly (the `copy-link` affordance's contract).
5. **T** Two tabs racing the *same* last open seat: exactly one is seated, the other gets a "room full" rejection and no ghost seat is created.
6. **T** A player closes their tab (disconnected), a new player joins the *other* open seat, then the first reopens with their stored session token — they reclaim their own original seat, and the newcomer keeps theirs.
7. **E** Seat occupancy locks mid-game: no toggle control exists on any seat once the game has started.

### 2.2 `lobby-settings.spec.ts` — host-only game settings
Capability: `game-setup-rules` + the three mechanics' toggles.

1. **H** Host toggles each of the three settings; every seated player's panel reflects the new value.
2. **E** A non-host sees the panel read-only (checkboxes present but disabled) and cannot change a value.
3. **H** Category ban **off** → `StartGame` goes straight to base selection, no ban card ever shown.
4. **H** Category ban **on** → the ban card is shown to every active player before base selection.
5. **E** The settings panel is gone once the game starts (settings are fixed at `StartGame`).
6. **T** Host flips a setting while a second player is mid-join — the joiner's first render already carries the current values, not stale defaults.

### 2.3 `category-ban-draft.spec.ts`
Capability: `category-ban-draft`.

1. **H** Both players propose 3 categories → the draft resolves, the result popup lists the banned set, base selection begins.
2. **E** The selection cap holds at 3: a 4th chip click does not select.
3. **E** An explicit empty proposal ("submit none") is accepted and resolves normally.
4. **E** A partial proposal (1 category) is accepted.
5. **T** In-flight privacy: after player A submits, player B's view shows A as *submitted* but never which chips A picked, and A's own card is sealed with no resubmit affordance (second submission impossible).
6. **T** A player who never submits: the draft still resolves on its own deadline (~20 s) and the game proceeds — no stall.
7. **T** **Banned categories never appear again**: capture the resolved banned set, then drive the game through the first N land-grab questions and assert every prompt's category (resolved via the sharded bank files) is outside the banned set.

### 2.4 `base-selection.spec.ts`
Capabilities: `base-selection-flow`, `game-setup-rules`.

1. **H** Seat-order picking: player 1 picks, the turn passes to player 2, the last pick flows straight into land grab's first question with no intervening dead state.
2. **E** A player who is not the current picker has no selectable region and cannot claim one.
3. **E** The minimum-distance rule is visible in the eligible set: regions adjacent to an already-taken base are not offered to the next picker.
4. **E** Every viewer sees the same eligible set and the same "whose turn" banner (nothing about base selection is secret).
5. **T** Timeout fallback: the current picker does nothing for the full 15 s window — a base is picked for them automatically and the phase advances (no stall, no duplicate base).

### 2.5 `land-grab.spec.ts`
Capability: `land-grab-flow`.

1. **H** All active players get the same question simultaneously; the winner is queued 2 picks and the runner-up 1, interleaved `[1st, 2nd, 1st]` — asserted by ownership counts after the queue drains.
2. **E** Own answer echoes back as locked-in ("sealed"), and survives a page refresh.
3. **T** In-flight privacy: the opponent shows as *answered* but their value is never rendered before resolution.
4. **E** A region pick must border owned territory: a non-bordering free region is not offered while a bordering one exists.
5. **E** The picker's turn auto-resolves on its deadline and the queue advances.
6. **T** **Dead round**: both players stay silent for a whole question — no territory is awarded, no award queue starts, and a fresh question is asked to the same participants.
7. **H** Land grab ends the moment the last free region is claimed and Battle's first turn begins immediately.

### 2.6 `battle-duels.spec.ts`
Capabilities: `battle-flow`, `answer-ranking`, `duel-defense-score-bonus`.

1. **H** Attacker answers correctly, defender wrong → the region transfers to the attacker **after** the reveal closes, not at resolution time.
2. **H** Defender answers correctly, attacker wrong → ownership unchanged **and** the defender's score gains the duel-defense bonus (200) while the attacker's is unchanged.
3. **T** Double timeout → defender-favoured tie-break keeps the region with the defender.
4. **E** Attack-target legality: a non-adjacent enemy region and the attacker's own region are never offered as targets.
5. **E** `RevealHold` accepts nothing: no answer affordance exists while a reveal is up, and it always advances on its own.
6. **T** Turn order across a full round: after both players have attacked, the round counter advances and turn order restarts from seat order.

### 2.7 `battle-base-assault.spec.ts`
Capabilities: `battle-flow` (assault + endgame), extends today's single-hit bonus test.

1. **H** Base assaults are locked before `BaseAssaultUnlockRound` (round 8) — an adjacent enemy base is not a legal target in earlier rounds — and become legal at round 8.
2. **H** A chained assault: consecutive attacker wins each drop the base by 1 HP and immediately re-ask, with the HP pips falling in step.
3. **T** HP is persistent and global: an assault ended early by a defender win leaves the damage in place, still visible on a later turn.
4. **T** **Full capture → elimination → game over**: the attacker wins the whole chain, takes the base *and* every other region the defender owned, the defender is marked eliminated, and the game ends immediately as last-player-standing with the results screen showing the winner.
5. **E** Self-heal: a damaged base becomes a self-targetable region once assaults unlock; a correct answer heals 1 HP and keeps the turn, an incorrect one ends it.
6. **E** A captured base is worth its map value, not the 1000-point base bonus.

### 2.8 `leave-and-takeover.spec.ts`
Capability: `player-leave-and-takeover`.

1. **H** An explicit mid-game leave hands the seat to bot control; the game keeps moving through that seat without ever waiting out a deadline.
2. **T** **Rejoining after leaving does not restore human control**: the same player returns to the same room with their token and the seat stays bot-controlled.
3. **T** A dropped connection alone (tab closed) is *not* a takeover: the seat shows disconnected and still waits on that player's own input / the timeout fallback.
4. **E** Leaving in the lobby still just frees the seat (no bot).
5. **T** Leaving *while it is your own turn* still gets a timely bot move rather than a deadline wait.

### 2.9 `kick-edge-cases.spec.ts`
Capability: `host-kick-player`. (Kept in a separate file from `kick-player.spec.ts` so the harness
agent's fixes and these additions never touch the same file.)

1. **T** **A kicked player rejoins the same lobby** — the seat they lost is open, so they get seated again as a *new* player with a new seat/token; their old token grants nothing.
2. **T** A kicked player's stored session presented mid-game restores nothing under either disposition (bot takeover and territory release both).
3. **E** A non-host has no kick affordance at all; the host has none on their own seat.
4. **T** Kicking the player who currently holds the base pick (territory release) advances to the next picker immediately instead of waiting out their deadline.
5. **T** Kicking the current attacker mid-Battle (territory release) passes the turn immediately and their released land is neutral, credited to nobody.
6. **E** The kicked player's message is distinct from a room-closed message.

### 2.10 `answer-streaks.spec.ts`
Capability: `answer-streaks`.

1. **H** Consecutive correct answers grow the badge; tiers cross bronze (1–3) → silver (4–5).
2. **E** A wrong answer resets the badge to nothing.
3. **E** A timeout resets the streak exactly as a wrong answer does.
4. **T** Bonus arithmetic: the answer that moves a streak from 2 → 3 adds exactly `2 × 50 = 100` to score, with the golden toggle **off** so no doubling can confound the read; the first correct answer of a streak adds 0.
5. **E** With the setting off, no badge ever appears and no streak bonus is ever scored.
6. **E** The streak survives the land-grab → battle phase transition.

### 2.11 `golden-question.spec.ts`
Capability: `golden-question`.

1. **T** Golden status is never revealed early: while any question is pending, no golden marker exists anywhere in the view; the banner can only appear on a reveal.
2. **H** Over a driven game, golden reveals appear at most `GoldenQuestionMaxCount` (3) times, and never twice within the cooldown window of questions.
3. **E** With the setting off, no golden banner ever appears for a whole game.
4. **T** A golden land-grab reveal doubles the award queue (4 picks for 1st instead of 2) — asserted by counting the picks actually offered after that reveal.

### 2.12 `onboarding-localization.spec.ts`
Capabilities: `client-onboarding`, `localization`.

1. **H** "How to play" opens from the landing screen and covers all four phases.
2. **E** It closes via its close control and via Escape, returning focus to the trigger.
3. **E** Tab/Shift+Tab stay trapped inside the modal while it is open.
4. **H** The landing language toggle switches chrome to Russian, and a room created in Russian serves Russian question prompts and Russian region names.
5. **E** The language chosen at creation is fixed for the room: a joiner sees the room's language, not their own last toggle.

---

## 3. Deliberate exclusions (documented, not silent — per `e2e-test-tooling`)

| Not automated | Why |
| --- | --- |
| `room-lobby`: idle-room removal | `RoomOptions.IdleThreshold` is 15 min and hardcoded in `Program.cs`; automating it means a 15-minute test or a production change. Unchanged from today's documented gap. |
| `player-accounts`: Google sign-in, username uniqueness, refresh-token rotation, sign-out | Requires a real Google credential flow and a database; not reachable through the browser without stubbing the identity provider, which would stop being an E2E test. Anonymous play (the "no account required" requirement) *is* covered throughout. |
| `client-error-recovery` | No hook exists to force a render error from the outside; triggering one would require shipping a test-only crash path. |
| `client-audio-feedback` (actual audio) | Only the mute control's persistence is observable in a headless browser; cue playback is not assertable. |
| `question-bank` content rules (2000+ questions, ratios, bilingual completeness) | Static-content invariants, already enforced by `QuestionRepository`'s fail-fast startup validation — a browser adds nothing. |
| `map-topology`, `map-rendering`, `mobile-viewport-interaction`, `numeric-reveal-visualization`, `client-presentation` | Presentation/geometry rather than business logic, which is this plan's stated scope. `map-topology` is additionally guaranteed by `MapValidator` at startup. |
| `server-observability` | Log-shape assertions belong to the host process, not a browser session. |

---

## 4. Execution plan

**Wave 1 (serial):** harness agent — section 1 + fix the 4 red tests → 18/18 green.

**Wave 2 (parallel, one agent per file group, no shared file ownership):**

| Agent | Files |
| --- | --- |
| 1 | `room-lobby-extended.spec.ts`, `lobby-settings.spec.ts` |
| 2 | `category-ban-draft.spec.ts` |
| 3 | `base-selection.spec.ts`, `land-grab.spec.ts` |
| 4 | `battle-duels.spec.ts` |
| 5 | `battle-base-assault.spec.ts` |
| 6 | `leave-and-takeover.spec.ts`, `kick-edge-cases.spec.ts` |
| 7 | `answer-streaks.spec.ts`, `golden-question.spec.ts`, `onboarding-localization.spec.ts` |

**Wave 3:** full-suite run from a clean state; every failure triaged as either a test defect or a
product bug and fixed until the suite is 100 % green.

### Rules every agent follows

- Never edit `specs/helpers.ts` or another agent's spec file — a needed helper that does not exist
  goes in the agent's own file.
- Pin the lobby settings for anything score- or determinism-sensitive (streaks and golden off).
- Two-player, no-bot games wherever the rule under test allows it, answering the instant a question
  appears, so run time is dominated only by the fixed `RevealHold` window
  (`e2e-test-tooling`: "smallest game that still reaches it").
- Assert through roles, visible text, and the existing `data-testid`s; add a new `data-testid` to the
  client only when a scenario is otherwise unreachable.
