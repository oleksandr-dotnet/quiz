# client-onboarding Specification

## Purpose
Governs how the client makes the game's rules discoverable before a player starts or joins a game.

## Requirements

### Requirement: A rules explainer is discoverable from the landing screen
The landing screen SHALL present a visible control that opens a rules-explainer modal, so a
first-time player can learn how the game works before creating or joining a room.

#### Scenario: The control is visible on the landing screen
- **WHEN** the landing screen is rendered
- **THEN** a "How to play" control is visible and interactive

#### Scenario: Activating the control opens the modal
- **WHEN** the player activates the "How to play" control
- **THEN** the rules-explainer modal becomes visible

### Requirement: The rules explainer summarizes every game phase
The rules-explainer modal SHALL summarize, in plain language, every mechanic a game moves through:
the objective, room setup (room codes/invite links and bots filling empty seats), the optional
category-ban draft, base selection (including the minimum-distance rule between capitals), land grab
(ranked award picks and the dead-round fallback), battle turn order, duels for ordinary territory,
base assaults (the round they unlock, hit points, chained questions, the score bonus, and
self-healing a damaged capital), answer streaks, golden questions, and how score and the win
condition work.

#### Scenario: Every mechanic is covered
- **WHEN** the rules-explainer modal is open
- **THEN** its content includes a summary of the objective, setup, the category-ban draft, base
  selection, land grab, battle turn order, duels, base assaults (including self-heal), answer
  streaks, golden questions, and scoring/win conditions

### Requirement: The rules explainer is dismissible
The rules-explainer modal SHALL close when the player activates a visible close control, or presses
the Escape key, returning focus to the landing screen underneath.

#### Scenario: The close button dismisses the modal
- **WHEN** the modal is open and the player activates its close control
- **THEN** the modal closes and the landing screen beneath it is fully usable

#### Scenario: Escape dismisses the modal
- **WHEN** the modal is open and the player presses the Escape key
- **THEN** the modal closes

### Requirement: The rules explainer is fully localized
Every string the rules-explainer modal renders SHALL come from the active locale's resource bundle,
consistent with every other client-rendered string.

#### Scenario: The modal renders in the active locale
- **WHEN** the rules-explainer modal is open and the active locale is Russian
- **THEN** every string in the modal is rendered from the Russian resource bundle

### Requirement: The rules explainer manages keyboard focus correctly
The rules-explainer modal SHALL move keyboard focus into itself when it opens, trap Tab/Shift+Tab
navigation among its own focusable elements while open, and restore focus to whatever had it before
the modal opened once it closes.

#### Scenario: Opening the modal moves focus inside it
- **WHEN** the rules-explainer modal opens
- **THEN** keyboard focus is on an element inside the modal, not on any element behind it

#### Scenario: Tab does not leave the modal while it is open
- **WHEN** the rules-explainer modal is open and the player repeatedly presses Tab or Shift+Tab
- **THEN** focus cycles only among the modal's own focusable elements, never reaching an element on
  the page behind it

#### Scenario: Closing the modal returns focus to the trigger
- **WHEN** the rules-explainer modal closes
- **THEN** keyboard focus returns to the control that opened it
