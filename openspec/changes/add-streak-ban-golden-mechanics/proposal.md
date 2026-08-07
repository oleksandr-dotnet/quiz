## Why

Playtesting feedback is that rounds feel flat: there is no escalating stakes mechanic, no player
input into which trivia categories they'll face, and no rare high-tension moment during an
otherwise-routine question. Three additive, host-toggleable mechanics close that gap: answer
streaks (which reward consistency, mirrored visibly at each player's avatar), a pre-game category
ban draft (which gives players agency over the deck before it's dealt), and golden questions (a
rare double-or-nothing spike hidden until reveal).

## What Changes

- **Answer streaks**: every correct answer across land grab, duels, and base assaults extends a
  per-player streak counter; a wrong answer resets it to 0. Each correct answer while the streak is
  already at N awards `N * 50` bonus score (via the existing `PlayerState.BonusScore` channel — the
  same mechanism `BaseAssaultScoreBonus` already uses). A new domain event announces the award so
  clients can animate it. The streak count renders at each player's avatar with tiered styling:
  1-3 bronze, 4-5 silver, 6+ gold, 7+ gold with an added rainbow animation. Toggle:
  `GameRules.EnableAnswerStreaks` (default `true`).
- **Category ban draft**: a new phase between `Lobby` and `BaseSelection` (only entered when
  enabled). Every player sees the full set of available question categories (derived from the
  question repository, not hardcoded) and proposes up to 3 they'd like banned within a time limit.
  Resolution is deterministic and seeded: for each player in seat order, one category is drawn from
  that player's proposal (or, if they proposed fewer than 3 — including none — from whatever subset
  they did propose, or the full remaining pool if they proposed none) and banned for the rest of the
  game, for both choice and tip question pools. Two players' draws may land on the same category;
  no reroll-for-uniqueness. The client renders each category with a distinct emoji/icon so the
  picker reads at a glance. Toggle: `GameRules.EnableCategoryBanDraft` (default `true`).
- **Golden question**: 2-3 questions per game (seeded, spread across rounds rather than clustered),
  of any question type (land grab, duel, or base assault), are marked golden ahead of time via the
  room's `IRandomSource`. The golden flag is never exposed in any projected view until after that
  question resolves — only the reveal event carries it — so no player can play differently because
  they know. A correct answer on a golden question doubles the score/HP effect it would otherwise
  have produced; a wrong answer doubles the penalty, symmetric with how `BaseAssaultScoreBonus`
  already works. The client plays a distinct, more elaborate reveal animation and sound cue for a
  golden reveal, built on top of the existing reveal animation/audio pipeline rather than duplicating
  it. Toggle: `GameRules.EnableGoldenQuestion` (default `true`).
- **Host settings panel**: the lobby gains a pre-start settings panel (host-only, same authorization
  pattern as seat toggling) exposing the three toggles above, all defaulting to enabled. `StartGame`
  (or a new host-only command sent before it) carries the chosen settings into the room's
  `GameRules` for that game.
- Hand-sync the new/changed DTOs and events into `src/Triviador.Client/src/api/contracts.ts` per this
  repo's existing manual-sync convention.

## Capabilities

### New Capabilities
- `answer-streaks`: streak tracking across question types, the scaling bonus-score award, and the
  tiered avatar display.
- `category-ban-draft`: the new pre-game phase, category exposure, per-player proposal and
  timeout/partial-proposal handling, seeded per-player resolution, and the resulting question-pool
  exclusion.
- `golden-question`: seeded selection and spacing, the reveal-only visibility rule, and the
  symmetric doubling effect.

### Modified Capabilities
- `game-setup-rules`: three new `GameRules` toggles (plus a ban-draft duration constant), a new
  `CategoryBan` phase and its legal-command contract (only entered when the toggle is on), and the
  host-only settings command that must run before/at `StartGame`.
- `land-grab-flow`: land grab question resolution applies the streak award and golden doubling, and
  region-pick question selection excludes banned categories when the draft ran.
- `battle-flow`: duel and base-assault question resolution applies the streak award and golden
  doubling.
- `question-bank`: question selection for both choice and tip pools excludes any category banned for
  that game.
- `room-lobby`: the lobby gains a host-only pre-start settings panel for the three toggles.
- `client-presentation`: player avatar rendering gains the tiered streak badge; the category ban
  picker renders each category with a distinct icon/emoji.
- `client-audio-feedback`: a distinct audio cue plays on a golden reveal, subject to the same mute
  control as the existing reveal cue.
- `bot-gameplay`: a bot seat proactively submits its own category-ban proposal, the same way it
  already proactively acts on every other pending activity it owns.

## Impact

- `Triviador.Domain`: `GameRules`, `PlayerState` (streak counter), `GameState`/phase machine (new
  `CategoryBan` phase), `GameEvents` (streak-awarded, categories-banned, golden-revealed events),
  land grab and battle resolution paths, question-selection filtering.
- `Triviador.Application`: `RoomActor`/`StateProjector` DTO projection (streak count, category list,
  ban proposals, golden concealment until reveal), bot decision-making for the new ban-proposal
  input.
- `Triviador.Infrastructure`: `QuestionRepository`/`IQuestionRepository` category enumeration and
  banned-category filtering; seeded golden-question scheduling.
- `Triviador.Web`: `GameHub` new command(s) for settings + ban proposal.
- `Triviador.Client`: `LobbyScreen.tsx` (settings panel), `PlayerRoster.tsx`/avatar components
  (streak badge + tiers/rainbow animation), new category-ban-picker screen/component with emoji
  map, reveal animation/sound additions, `store/gameStore`, `api/contracts.ts`, `api/commands.ts`.
