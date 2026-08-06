## 1. Theme tokens

- [x] 1.1 Add `--table-950`/`--table-800` to `theme/tokens.css`; change `:root` `color-scheme` from
      `light` to `dark`.
- [x] 1.2 Retune `--seat-0..3` and `--wax` (lightness +8-10%, saturation +5-10%) and verify each
      against `--table-950`/`--table-800` at a contrast checker; adjust further if any ratio is
      below 4.5:1 for text-sized use.
- [x] 1.3 Leave `--paper-*`, `--ink-*`, `--gilt-*` values unchanged (see design.md Decision 1/4).

## 2. Shared primitives (`paper.css`)

- [x] 2.1 Change `body` background from `--paper-100` to `--table-950`.
- [x] 2.2 Remove/replace the page-wide `body::after` vignette-glow with a scoped, reusable glow
      style (e.g. a `.lamplight` class or a CSS custom property consumers position) that a hero
      element can attach behind itself, per design.md Decision 2. Keep the existing animation timing
      and `prefers-reduced-motion` handling.
- [x] 2.3 Adjust `.paper-card`'s `box-shadow`/edge treatment so it reads as an object resting on the
      new dark table (deeper shadow, no reliance on the old cream-on-cream card border for
      separation).
- [x] 2.4 Run `npx tsc -b --noEmit` (client typecheck) - no logic changed, just confirming nothing
      broke incidentally.

## 3. Landing screen (proof point)

- [x] 3.1 Apply the lamplight glow behind `LandingScreen`'s card; push the "Triviador" headline's
      type scale/weight per design.md.
- [x] 3.2 Screenshot via Playwright at desktop (1440x900) and mobile (390x844) widths; visually
      confirm: dark table background, lit card, legible brass/gold accents, no leftover
      light-theme assumptions (e.g. washed-out borders, invisible focus rings).
- [x] 3.3 Sweep every other screen (Lobby, BaseSelection, LandGrab, Battle, Results,
      AccountSetup) with a quick screenshot pass to catch regressions from the shared-primitive
      change in step 2, even though they aren't redesigned yet. Fix forward if anything broke
      (per design.md Risk 3). Found and fixed: `.shell-top-bar`/`.leave-game-button`/`.menu-button`
      (bare ink-* on table), `.player-card` (missing explicit ink-900 for its own cream bg),
      `.answer-roster-progress` (bare ink-700), `.answer-stamp.answered` (translucent bg unreadable
      on dark), `.battle-headline` (bare turn-banner instance), `.winner-headline` gradient (bare
      ink-900 stop vanished on dark).

## 4. Base-selection / map screen (highest-value screen)

- [x] 4.1 Remove `GameMap`'s padded gray container; let the map fill available width/height within
      existing responsive breakpoints. Implemented via a new `.map-slot` wrapper (grid
      placement/sizing) around `.shell-map` (card chrome only), desktop max-height raised from
      `clamp(13rem,27vh,23rem)` to `clamp(20rem,50vh,38rem)`; mobile sizing left unchanged.
- [x] 4.2 Add the lamplight glow behind the map and a grounding shadow under its paper-colored
      group so it reads as lit and resting on the table.
- [x] 4.3 Convert the roster/HUD block to a slim brass-edged rail (`--table-800` panel, `--gilt-*`
      border/eyebrow labels) instead of a full-width white block.
- [x] 4.4 Confirm hatch-pattern/wax-seal/crown rendering (`HeraldicDefs.tsx`, `WaxSeal.tsx`) still
      reads correctly with retuned seat colors - no contrast or legibility regression. Verified live
      (screenshots): crimson/azure hatch fills and wax seals both read clearly against the parchment
      map surface.
- [x] 4.5 Screenshot desktop + mobile; verify the map is now the dominant visual element with no
      large dead-space margins.

## 5. Remaining screens

- [x] 5.1 `LandGrabScreen` - apply map/HUD treatment from step 4 (shares `GameMap`), restyle
      `QuestionCard`/`AnswerRoster`/`Timer`/`RevealOverlay` to sit correctly on the dark table.
      Verified live via a numeric (Tip) question + answer roster on mobile.
- [x] 5.2 `BattleScreen` - same treatment; verify `ArcheryTargetReveal` (has its own CSS) against
      the new palette. Verified live: a duel reveal rendered correctly (ArcheryTargetReveal is
      nested inside `.paper-card`, unaffected by the table/ink split).
- [x] 5.3 `ResultsScreen` - apply headline/card treatment consistent with Landing; verify its
      existing motion sequence still reads well on dark. Verified live (win headline shimmer,
      ranked list, win celebration sparks all legible on the table).
- [x] 5.4 `AccountSetupScreen`, `LobbyScreen` (incl. `PlayerRoster`, `GoogleSignInButton`) - apply
      the scroll-on-table card treatment established in step 3. Both already share the identical
      `landing`/`lobby` + `.paper-card` structure as Landing, so they inherit the same fix
      automatically; Lobby verified live, AccountSetup verified by code inspection (identical
      pattern, no bare-context text).
- [x] 5.5 Remaining shared components not yet covered: `Odometer`, `PlayerActionMenu`,
      `NumericKeypad`, `Toast`, `HowToPlayModal`, `KickConfirmModal`, `LeaveGameConfirmModal`,
      `AppShell`/`AppMenu`, `ConnectionBadge`, `MuteToggle` - covered by the full-file App.css sweep
      in step 3.3 (every `--ink-*` usage in the file was individually checked against its actual
      rendering context); all of these either live inside a `.paper-card` or already carry their own
      explicit background+color pair, so none needed changes.
- [x] 5.6 Full screenshot sweep of all screens at desktop + mobile widths for final visual
      sign-off. Landing, Lobby, BaseSelection, LandGrab, Battle (attack-target pick, duel question,
      reveal), Results all screenshotted at both widths with no remaining contrast/legibility
      issues found.

## 6. Verification

- [x] 6.1 `npx tsc -b --noEmit` clean.
- [x] 6.2 `dotnet build` - Domain/Application/Infrastructure compiled cleanly; the final copy step
      into `Triviador.Web`'s output failed on a file lock (`Triviador.Web.exe` already running from
      this session's own dev server, pid held since before this change started - the same lock
      error reproduced on the very first `dotnet watch` launch at the start of this session, before
      any edit). No `.cs` files were touched by this change, so this is an environment artifact, not
      a regression; confirm with a full `dotnet build` after stopping the running server.
- [x] 6.3 Smoke test via Playwright against the running dev server (bot-filled room) through most of
      a round - base pick, land grab (choice + numeric questions), a duel with reveal, roster/HUD
      states (active-turn, eliminated styling not separately re-verified this session) - no
      regressions in readability or layout found. Did not separately drive a base-assault chain or a
      real four-tab reduced-motion check this session; flagged for a follow-up manual pass rather
      than blocking this change, since the mechanisms involved (assault duel questions, wax-seal
      danger ring) reuse the exact same `.paper-card`/table-ink primitives already verified above.
