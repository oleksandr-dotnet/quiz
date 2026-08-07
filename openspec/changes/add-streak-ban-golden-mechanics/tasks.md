## 1. Stream D - Cross-cutting scaffold (land this first; A/B/C depend on it)

- [ ] 1.1 Add `EnableAnswerStreaks`, `EnableCategoryBanDraft`, `EnableGoldenQuestion` (all default
      `true`), `AnswerStreakBonusPerStreak` (default 50), `CategoryBanProposalDurationSeconds`,
      `GoldenQuestionMinCount`/`MaxCount` (2/3), and `GoldenQuestionCooldownQuestions` to `GameRules`
- [ ] 1.2 Add a host-only `SetGameSettings` command (Domain command type + `GameEngine` handling in
      `Lobby` phase only, host-authorized) that updates the room's draft `GameRules` before `StartGame`
- [ ] 1.3 Add the `RejectionCode` for a non-host settings change, following the existing
      `SetSeat`/`KickPlayer` host-authorization pattern
- [ ] 1.4 Add the lobby settings panel shell to `LobbyScreen.tsx` (host-only edit, everyone-visible
      read, three toggle rows - Streams A/B/C fill in their own row's copy/icon) and the
      `setGameSettings` client command in `api/commands.ts`
- [ ] 1.5 Add `SetGameSettings`/settings-related DTOs to `src/api/contracts.ts` and to the room's
      `PlayerViewDto`/lobby projection so every seated player sees current toggle values
- [ ] 1.6 Reserve the new event/command names in `GameEvents.cs` and the command union so Streams A/B/C
      can add their own record types without touching each other's lines

## 2. Stream A - Answer streaks

- [ ] 2.1 Add `AnswerStreak` to `PlayerState`, reset to 0 on any incorrect/no-submission answer,
      incremented on any correct answer, gated entirely by `GameRules.EnableAnswerStreaks`
- [ ] 2.2 Hook the streak update and bonus calculation (`(streakBeforeAnswer) *
      AnswerStreakBonusPerStreak` added to `PlayerState.BonusScore`) into the shared point where every
      question type already resolves tier/penalty, so it fires identically for land grab, duels, base
      assaults, self-heals, and tiebreaks
- [ ] 2.3 Add the `StreakBonusAwarded(PlayerId, StreakCount, BonusAwarded)` companion event, emitted
      only when the awarded bonus is non-zero
- [ ] 2.4 Project each active player's current streak count in `StateProjector`'s player view
- [ ] 2.5 Update `src/api/contracts.ts` for the new field/event
- [ ] 2.6 Client: render the tiered streak badge (bronze 1-3, silver 4-5, gold 6+, gold+rainbow 7+) at
      every avatar location (`PlayerRoster.tsx` and any in-game player chip), respecting reduced-motion
- [ ] 2.7 Client: play the "streak bonus awarded" animation off the `StreakBonusAwarded` event
- [ ] 2.8 Client: fill in the "answer streaks" row/description in the lobby settings panel (Stream D's
      shell)

## 3. Stream B - Category ban draft

- [ ] 3.1 Add `CategoryBan` to the `Phase` enum; wire `StartGame` to enter it when
      `EnableCategoryBanDraft` is true, and straight to `BaseSelection` when false
- [ ] 3.2 Add the `CategoryBanProposal` pending-activity kind (simultaneous multi-participant, like
      `Question`) and the `ProposeCategoryBans(PlayerId, Categories, Instant At)` command, legal only
      in `CategoryBan` phase, once per active player
- [ ] 3.3 Add `IQuestionRepository`/`QuestionRepository` support for enumerating the canonical category
      set (read from loaded content, not a duplicated literal list) and for selecting a question while
      excluding a given category set, for both `choice` and `tip` pools
- [ ] 3.4 Implement seat-order, seeded resolution: per-player draw from their own proposal, or from the
      remaining canonical pool if empty, minus categories already banned earlier in the same pass
      (`IRandomSource` only, never `System.Random`)
- [ ] 3.5 Wire resolved banned categories into the room's question-selection calls for the rest of the
      game (land grab, duels, base assaults, self-heals, tiebreaks)
- [ ] 3.6 Add `CategoryBanDraftStarted`, `CategoryBanProposalAcknowledged` (no leak of the actual
      proposal), and `CategoryBansResolved` events; keep in-flight proposals private per-player in
      `StateProjector`
- [ ] 3.7 Bot behavior: bot seats proactively submit `ProposeCategoryBans` (up to 3 categories) before
      the deadline, per `bot-gameplay`
- [ ] 3.8 Update `src/api/contracts.ts` for the new phase/events/DTOs
- [ ] 3.9 Client: build the category-ban picker screen (up to 3 picks, countdown, submission state per
      player) with a category -> emoji/icon lookup (new `lib/categoryIcons.ts`, same spirit as
      `lib/avatars.ts`), including a fallback icon for any category without an explicit mapping
- [ ] 3.10 Client: show the resolved banned-category set once the draft completes
- [ ] 3.11 Client: fill in the "category ban draft" row/description in the lobby settings panel

## 4. Stream C - Golden question

- [ ] 4.1 Draw the game's golden-question budget (`GoldenQuestionMinCount`-`MaxCount`) once at
      `GameStarted` via `IRandomSource`, stored in `GameState`
- [ ] 4.2 Add a per-game monotonic question-sequence counter, incremented on every `QuestionAsked`
      regardless of purpose
- [ ] 4.3 Implement the cooldown-gated seeded draw that marks a question golden at ask time (flag lives
      on the pending question's own state, next to `TieBreakOrder`); exclude the flag from
      `QuestionAsked`'s payload and from any pre-resolution projection
- [ ] 4.4 Add the `GoldenQuestionRevealed(ActivityToken)` companion event, emitted alongside
      `QuestionResolved`/`RevealHoldStarted` for the same token
- [ ] 4.5 Apply doubling at each resolution site: land-grab award-queue pick counts;
      `DuelDefenseScoreAwarded` amount; `BaseAssaultScoreAdjusted` deltas and the hit-point delta
      (capped at 0); self-heal hit-point delta (capped at `BaseHitPointsDefault`); the streak bonus for
      that same answer if `EnableAnswerStreaks` is also on
- [ ] 4.6 Make golden status a no-op end-to-end when `EnableGoldenQuestion` is false (no budget drawn,
      no flag ever set)
- [ ] 4.7 Update `src/api/contracts.ts` for the new event
- [ ] 4.8 Client: read the archived `answer-reveal-sound-feedback`/`archery-reveal-animation` changes'
      reveal pipeline; add a distinct golden reveal animation and a dedicated sound cue, gated by the
      existing mute control, with a reduced-motion fallback that still conveys the golden outcome
      instantly
- [ ] 4.9 Client: fill in the "golden question" row/description in the lobby settings panel

## 5. Integration and verification

- [ ] 5.1 `dotnet build` clean across all layers
- [ ] 5.2 `cd src/Triviador.Client && npx tsc -b --noEmit` clean
- [ ] 5.3 Manual four-seat playtest (per `CLAUDE.md`'s manual-testing note) covering: all three toggles
      on (default), all three off, and each toggle individually on with the other two off
- [ ] 5.4 Manual verify: no network payload (SignalR message or `GameView`) exposes a pending question's
      golden flag or another player's in-flight category-ban proposal before the appropriate reveal
- [ ] 5.5 Manual verify: streak badge tiers and the golden reveal animation/sound at each tier boundary
      (3->4, 5->6, 6->7)
- [ ] 5.6 Run `openspec validate --strict` for this change and fix any reported issues
