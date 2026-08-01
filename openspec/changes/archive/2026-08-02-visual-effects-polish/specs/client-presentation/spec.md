## ADDED Requirements

### Requirement: A viewer's own winning outcome receives a distinct celebratory presentation
When the viewer's own player is among `outcome.winnerPlayerIds` on a `Finished` `GameView`, the client SHALL present a visually distinct celebratory treatment beyond the shared winner headline shown to every viewer (winners, losers, and draws alike) - so winning reads as an occasion, not the same generic outcome screen with different text.

#### Scenario: The viewer's own win is celebrated
- **WHEN** the client's own player id is in `outcome.winnerPlayerIds` and there is exactly one
  winner
- **THEN** the results screen plays a celebratory animation (e.g. gilt spark/banner flourish)
  in addition to the winner headline

#### Scenario: A loss or draw does not play the winner celebration
- **WHEN** the viewer's own player id is not in `outcome.winnerPlayerIds`, or `winnerPlayerIds`
  contains more than one player (a draw)
- **THEN** the client does not play the winning-player celebratory animation, though the shared
  outcome headline and standings are still shown

#### Scenario: Reduced motion still shows the outcome
- **WHEN** `prefers-reduced-motion: reduce` is active and the viewer won
- **THEN** the client shows the same winner state (headline, standings, winner banner) without the
  animated celebration effect
