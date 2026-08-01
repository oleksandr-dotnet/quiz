## Why

Numeric ("Tip") question reveals currently show a flat `NumberLine`: a horizontal track with a tick
for the correct answer and colored pins placed by percentage between the min/max submitted values.
It communicates rank order but doesn't make "how close was I" *feel* like anything - there's no
sense of accuracy, no suspense, no payoff moment when the closest guess is revealed. An
archery-target framing (bullseye = correct answer, each player's arrow lands at a distance
proportional to their error) reuses the exact same ranking data already computed server-side but
turns it into a much more legible and satisfying reveal, consistent with the game's existing
reveal-overlay ranked list (laurel numerals, speed bars) which already rewards accuracy/speed
visually elsewhere.

## What Changes

- Replace the `NumberLine` sub-component in `RevealOverlay.tsx` (the `prompt.kind === 'Tip'` branch
  only) with a new `ArcheryTargetReveal` component: concentric rings, bullseye at the correct
  answer, one arrow per numeric-answering player landing at a radius proportional to
  `|answer - correctAnswer|` normalized against the spread of submitted answers.
- Arrows animate in with a rank-ordered stagger (worst-to-best, building suspense toward the closest
  guess) and a brief landing "thunk" (scale/shake) micro-animation, followed by a compact
  name label in the player's seat color.
- All motion timing derives from the existing `--dur-fast/mid/slow` custom properties (already
  zeroed/shortened under `prefers-reduced-motion`), so reduced-motion users get the same
  information with arrows placed immediately and no flight/impact animation.
- Purely presentational: no changes to any DTO, contract, or server-side ranking/evaluation logic.
  The Choice-question reveal branch (ranked list with ✓/✗) is untouched.
- New component file(s) and scoped CSS live under `Triviador.Client`; no changes to
  `App.css`/`theme/tokens.css` beyond additive, feature-scoped custom properties if needed.

## Capabilities

### New Capabilities
- `numeric-reveal-visualization`: the archery-target presentation for numeric ("Tip") question
  reveals - ring layout, bullseye, per-player arrow placement/animation, staggered reveal order,
  labeling, and reduced-motion behavior.

### Modified Capabilities
(none - `client-presentation`'s existing requirements around visible feedback and reduced-motion
already cover this at a general level; this change satisfies them for the Tip-reveal case rather
than changing their wording)

## Impact

- `src/Triviador.Client/src/components/RevealOverlay.tsx` - removes `NumberLine`, renders the new
  component in the `Tip` branch instead.
- New file: `src/Triviador.Client/src/components/ArcheryTargetReveal.tsx` (or similar name).
- New/scoped CSS (either a small dedicated stylesheet imported by the new component, or a
  tightly-scoped block appended to `App.css` under a clearly-commented section) for rings, arrows,
  and landing keyframes.
- No server, DTO, or contract changes. No other screens/components touched.
