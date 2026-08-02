## MODIFIED Requirements

### Requirement: An unresponsive turn or reveal resolves on its own
`GameEngine` SHALL automatically select a legal attack target for the player on turn if they do not
select one before the deadline (or skip their turn if none exist), and SHALL advance past a
`RevealHold` on its deadline exactly as if it had been acknowledged immediately. A bot player on
turn SHALL NOT rely on the automatic-selection fallback in the normal case: per `bot-gameplay`, a
bot actively submits its own `SelectAttackTarget` choice before the deadline. This fallback remains
the resolution path for a disconnected or unresponsive human, and remains a bot's own safety net if
its scheduled submission is somehow not accepted in time. `RevealHold` is unaffected by bot
behavior: no player, bot or human, ever acts on a reveal, so it always resolves by timeout for
everyone.

#### Scenario: A disconnected attacker's turn resolves automatically
- **WHEN** the player on turn is a disconnected or otherwise unresponsive human and does not submit
  `SelectAttackTarget` before the deadline
- **THEN** one of that player's legal attack targets is selected automatically and a question is
  asked, exactly as a manual selection would produce

#### Scenario: A bot attacker's turn resolves via its own selection
- **WHEN** the player on turn is a bot seat
- **THEN** the bot submits its own `SelectAttackTarget` choice before the deadline in the normal
  case and a question is asked, exactly as a manual selection would produce; a legal target is
  still selected for it automatically if, for any reason, it has not acted once the deadline passes

#### Scenario: A reveal always advances even with no viewer acknowledgment
- **WHEN** a `RevealHold`'s deadline passes via `TimeoutElapsed`
- **THEN** the pump advances to whatever comes next (the next assault question, the next turn, or
  end conditions) with no player input required, regardless of whether any participant is a bot
