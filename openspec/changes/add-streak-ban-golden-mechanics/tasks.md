## 1. Stream D - Cross-cutting scaffold (land this first; A/B/C depend on it)

- [x] 1.1 Add `EnableAnswerStreaks`, `EnableCategoryBanDraft`, `EnableGoldenQuestion` (all default
      `true`), `AnswerStreakBonusPerStreak` (default 50), `CategoryBanProposalDurationSeconds`,
      `GoldenQuestionMinCount`/`MaxCount` (2/3), and `GoldenQuestionCooldownQuestions` to `GameRules`
- [x] 1.2 Add a host-only `SetGameSettings` command (Domain command type + `GameEngine` handling in
      `Lobby` phase only, host-authorized) that updates the room's draft `GameRules` before `StartGame`
- [x] 1.3 Add the `RejectionCode` for a non-host settings change, following the existing
      `SetSeat`/`KickPlayer` host-authorization pattern
- [x] 1.4 Add the lobby settings panel shell to `LobbyScreen.tsx` (host-only edit, everyone-visible
      read, three toggle rows - Streams A/B/C fill in their own row's copy/icon) and the
      `setGameSettings` client command in `api/commands.ts`
- [x] 1.5 Add `SetGameSettings`/settings-related DTOs to `src/api/contracts.ts` and to the room's
      `PlayerViewDto`/lobby projection so every seated player sees current toggle values
- [x] 1.6 Reserve the new event/command names in `GameEvents.cs` and the command union so Streams A/B/C
      can add their own record types without touching each other's lines

## 2. Stream A - Answer streaks

- [x] 2.1 Add `AnswerStreak` to `PlayerState`, reset to 0 on any incorrect/no-submission answer,
      incremented on any correct answer, gated entirely by `GameRules.EnableAnswerStreaks`
- [x] 2.2 Hook the streak update and bonus calculation (`(streakBeforeAnswer) *
      AnswerStreakBonusPerStreak` added to `PlayerState.BonusScore`) into the shared point where every
      question type already resolves tier/penalty, so it fires identically for land grab, duels, base
      assaults, self-heals, and tiebreaks
- [x] 2.3 Add the `StreakBonusAwarded(PlayerId, StreakCount, BonusAwarded)` companion event, emitted
      only when the awarded bonus is non-zero
- [x] 2.4 Project each active player's current streak count in `StateProjector`'s player view
- [x] 2.5 Update `src/api/contracts.ts` for the new field/event
- [x] 2.6 Client: render the tiered streak badge (bronze 1-3, silver 4-5, gold 6+, gold+rainbow 7+) at
      every avatar location (`PlayerRoster.tsx` and any in-game player chip), respecting reduced-motion
- [x] 2.7 Client: play the "streak bonus awarded" animation off the `StreakBonusAwarded` event
- [x] 2.8 Client: fill in the "answer streaks" row/description in the lobby settings panel (Stream D's
      shell)

## 3. Stream B - Category ban draft

- [x] 3.1 Add `CategoryBan` to the `Phase` enum; wire `StartGame` to enter it when
      `EnableCategoryBanDraft` is true, and straight to `BaseSelection` when false
- [x] 3.2 Add the `CategoryBanProposal` pending-activity kind (simultaneous multi-participant, like
      `Question`) and the `ProposeCategoryBans(PlayerId, Categories, Instant At)` command, legal only
      in `CategoryBan` phase, once per active player
- [x] 3.3 Add `IQuestionRepository`/`QuestionRepository` support for enumerating the canonical category
      set (read from loaded content, not a duplicated literal list) and for selecting a question while
      excluding a given category set, for both `choice` and `tip` pools
- [x] 3.4 Implement seat-order, seeded resolution: per-player draw from their own proposal, or from the
      remaining canonical pool if empty, minus categories already banned earlier in the same pass
      (`IRandomSource` only, never `System.Random`)
- [x] 3.5 Wire resolved banned categories into the room's question-selection calls for the rest of the
      game (land grab, duels, base assaults, self-heals, tiebreaks)
- [x] 3.6 Add `CategoryBanDraftStarted`, `CategoryBanProposalAcknowledged` (no leak of the actual
      proposal), and `CategoryBansResolved` events; keep in-flight proposals private per-player in
      `StateProjector`
- [x] 3.7 Bot behavior: bot seats proactively submit `ProposeCategoryBans` (up to 3 categories) before
      the deadline, per `bot-gameplay`
- [x] 3.8 Update `src/api/contracts.ts` for the new phase/events/DTOs
- [x] 3.9 Client: build the category-ban picker screen (up to 3 picks, countdown, submission state per
      player) with a category -> emoji/icon lookup (new `lib/categoryIcons.ts`, same spirit as
      `lib/avatars.ts`), including a fallback icon for any category without an explicit mapping
- [x] 3.10 Client: show the resolved banned-category set once the draft completes
- [x] 3.11 Client: fill in the "category ban draft" row/description in the lobby settings panel

## 4. Stream C - Golden question

- [x] 4.1 Draw the game's golden-question budget (`GoldenQuestionMinCount`-`MaxCount`) once at
      `GameStarted` via `IRandomSource`, stored in `GameState`
- [x] 4.2 Add a per-game monotonic question-sequence counter, incremented on every `QuestionAsked`
      regardless of purpose
- [x] 4.3 Implement the cooldown-gated seeded draw that marks a question golden at ask time (flag lives
      on the pending question's own state, next to `TieBreakOrder`); exclude the flag from
      `QuestionAsked`'s payload and from any pre-resolution projection
- [x] 4.4 Add the `GoldenQuestionRevealed(ActivityToken)` companion event, emitted alongside
      `QuestionResolved`/`RevealHoldStarted` for the same token
- [x] 4.5 Apply doubling at each resolution site: land-grab award-queue pick counts;
      `DuelDefenseScoreAwarded` amount; `BaseAssaultScoreAdjusted` deltas and the hit-point delta
      (capped at 0); self-heal hit-point delta (capped at `BaseHitPointsDefault`); the streak bonus for
      that same answer if `EnableAnswerStreaks` is also on
- [x] 4.6 Make golden status a no-op end-to-end when `EnableGoldenQuestion` is false (no budget drawn,
      no flag ever set)
- [x] 4.7 Update `src/api/contracts.ts` for the new event
- [x] 4.8 Client: read the archived `answer-reveal-sound-feedback`/`archery-reveal-animation` changes'
      reveal pipeline; add a distinct golden reveal animation and a dedicated sound cue, gated by the
      existing mute control, with a reduced-motion fallback that still conveys the golden outcome
      instantly
- [x] 4.9 Client: fill in the "golden question" row/description in the lobby settings panel

## 5. Integration and verification

- [x] 5.1 `dotnet build` clean across all layers
- [x] 5.2 `cd src/Triviador.Client && npx tsc -b --noEmit` clean
- [x] 5.3 Manual playtest via Playwright against a running dev server (default settings, host + 3
      bots): confirmed lobby settings panel, category-ban picker (explicit submit and timeout-fallback
      paths), the banned-categories indicator, base selection, and a live streak badge appearing on a
      bot after a correct land-grab answer. Caught and fixed a real bug this way (Phase never advanced
      to BaseSelection after the draft resolved - see the follow-up commit). NOT yet covered: all-three-
      off, each-toggle-individually-on, a full game to Battle/Finished, or an actual golden-question
      hit (none happened to roll in the short session tested)
- [ ] 5.4 Manual verify: no network payload (SignalR message or `GameView`) exposes a pending question's
      golden flag or another player's in-flight category-ban proposal before the appropriate reveal -
      verified by code inspection (IsGolden/proposals are only ever added to reveal-stage DTOs, never
      to PendingQuestionViewDto/PendingCategoryBanViewDto's pre-resolution fields) but not by capturing
      live traffic
- [ ] 5.5 Manual verify: streak badge tiers and the golden reveal animation/sound at each tier boundary
      (3->4, 5->6, 6->7) - not yet exercised end-to-end (would need a longer play session or a seed
      chosen to force it)
- [x] 5.6 Run `openspec validate --strict` for this change and fix any reported issues
