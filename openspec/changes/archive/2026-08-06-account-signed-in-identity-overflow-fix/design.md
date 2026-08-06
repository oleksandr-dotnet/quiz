## Context

`.landing` (shared by `LandingScreen` and `AccountSetupScreen`) is `display: flex; flex-direction:
column; align-items: center`. `align-items: center` sizes flex children to their own max-content
width rather than stretching them to the container's width - `.landing input` already overrides this
explicitly (`width: 100%`) for exactly this reason, per the comment already in `App.css` next to that
rule. `.signed-in-identity` never got the same treatment: it's a flex row with no width of its own,
so its rendered width is the sum of its three children's natural widths, uncapped by the viewport.
See proposal.md - Why for the measured overflow this caused.

## Goals / Non-Goals

**Goals:**
- Stop a long unbroken username from causing document-level horizontal overflow on the landing
  screen, using the same truncate-not-displace technique already proven for `.seat-name`.
- No visual change for the common case (a normal-length username).

**Non-Goals:**
- Changing how usernames are chosen/validated (`AccountSetupScreen`'s `^[A-Za-z0-9_]{3,20}$` already
  bounds length to 20 chars server-side-enforced; this fix is about layout robustness regardless of
  where a long value comes from - e.g. a wide font rendering, a different locale's string).
- Restructuring `LandingScreen`'s signed-in JSX; only class names were added.

## Decisions

- **Give `.signed-in-identity` `width: 100%`, then let its username child do the truncating.** This
  mirrors `.seat` (`width: 100%` inherited from `.seat-list`) + `.seat-name` (`flex: 1 1 auto;
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`) exactly - the
  established pattern in this codebase for "flex row where one text segment must yield and the rest
  must not." `min-width: 0` overrides the flex item default of `min-width: auto`, which otherwise
  stops a flex item from shrinking below its content's intrinsic width, which is precisely what let
  the row overflow.
- **`.signed-in-signout { flex: 0 0 auto }`** keeps the button at its natural size so it can never be
  the thing that shrinks - it must stay tappable and reachable, so all the give comes from the text.
- **Truncate the whole "Signed in as {username}" string, not just the username substring.** The JSX
  already renders it as one interpolated i18n string in one `<span>`; splitting it into two spans
  (static prefix + username) to truncate only the username would be a larger, avoidable change for a
  cosmetic difference (both approaches keep "Sign out" visible, which is the actual requirement).

## Risks / Trade-offs

- A very long username's tail is now hidden behind an ellipsis on this row → acceptable: the same
  trade-off is already accepted for lobby seat names, and the identity's full value remains available
  elsewhere (e.g. hover/title is not added here since touch devices have no hover, but this is a
  pre-existing gap shared with `.seat-name` and out of scope for this fix).
