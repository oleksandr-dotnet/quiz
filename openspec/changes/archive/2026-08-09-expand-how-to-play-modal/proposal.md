## Why

The "How to play" modal only ever summarized four phases (base selection, land grab, battle, win
condition) in one sentence each. It never mentions the category-ban draft, base-assault unlock
round, self-heal, answer streaks, or golden questions - mechanics a first-time player has no other
way to discover before they hit them mid-game. The goal is a genuinely complete rules explainer for
new players, on the same responsive modal used on both mobile and desktop.

## What Changes

- Restructure `HowToPlayModal` from 4 terse sections to 11, following the actual phase/mechanic
  order a room goes through: objective, setup (room codes/bots/turn order), the optional
  category-ban draft, base selection (including the minimum-distance rule), land grab (ranked award
  picks and the dead-round fallback), battle turn order, duels, base assaults (unlock round, hit
  points, chained questions, score bonus, self-heal), answer streaks, golden questions, and
  scoring/win conditions.
- Add three new mirrored `GameRules` display constants to `lib/gameRules.ts`
  (`BASE_ASSAULT_UNLOCK_ROUND`, `MINIMUM_BASE_DISTANCE`) alongside the two that already existed, and
  interpolate them into the new copy instead of hardcoding numbers a second time.
- Rewrite the `howToPlay.*` keys in both `en.json` and `ru.json` to match the new section set.
- Update the `client-onboarding` spec's "every game phase" requirement to describe the full mechanic
  set instead of just the original four phases.
- Update the e2e test that asserted exactly 4 headings to match the new section count/content.

## Capabilities

### Modified Capabilities
- `client-onboarding`: "The rules explainer summarizes every game phase" now requires coverage of
  every mechanic (category-ban draft, base assaults, self-heal, streaks, golden questions, scoring),
  not just the original four top-level phases.

## Impact

- `src/Triviador.Client/src/components/HowToPlayModal.tsx`
- `src/Triviador.Client/src/lib/gameRules.ts`
- `src/Triviador.Client/src/i18n/resources/en.json`, `ru.json`
- `tests/e2e/specs/onboarding-localization.spec.ts`
- No server/domain changes - this is client copy only, reading existing `GameRules` values.
