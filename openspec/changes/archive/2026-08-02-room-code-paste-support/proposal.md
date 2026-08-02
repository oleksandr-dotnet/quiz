## Why

The landing screen's 4-character room-code entry is split across four separate single-character
inputs. Pasting a full code into it (the natural flow when a code is shared via chat/text, which is
how join codes are meant to be distributed) silently keeps only the last pasted character and
advances focus by a single cell, leaving three cells empty with no error and no indication anything
went wrong. The player is forced to notice this and re-type all four characters by hand. This is a
plain UX bug in a very common flow, not a missing feature.

## What Changes

- Handle a paste event on the room-code cells: distribute the pasted text's characters (uppercased,
  non-alphanumeric characters stripped) across the cells starting at the cell that was focused/
  pasted into, filling as many subsequent cells as the pasted text has characters (up to the
  remaining 4-character length), and move focus to the first empty cell after the paste (or the
  last cell if all four are now filled).
- Existing single-character typing behavior (auto-advance, backspace-to-previous) is unchanged.
- No change to game logic, rules, DTOs, or server/domain code - client-only presentation fix.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `client-presentation`: adds a requirement that multi-character input pasted into a
  single-character-per-cell control is distributed across the cells rather than truncated to one
  character.

## Impact

- Affected code: `src/Triviador.Client/src/screens/LandingScreen.tsx` only. No server, domain, or
  DTO changes, no new dependencies.
