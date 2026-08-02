## ADDED Requirements

### Requirement: Pasted multi-character input fills a per-character cell control
When a player pastes text into a control made of separate single-character cells (such as the
room-join code entry), the client SHALL distribute the pasted characters across the cells starting
at the cell that received the paste, rather than truncating the paste to a single character in one
cell.

#### Scenario: Pasting a full room code fills every cell
- **WHEN** a player pastes a 4-character string into the first cell of the room-code entry
- **THEN** all four cells are filled with the pasted string's characters, uppercased, in order

#### Scenario: Pasting into a later cell fills from that cell forward
- **WHEN** a player pastes a string into a cell that is not the first, with fewer remaining cells
  than the pasted string's length
- **THEN** the cells from the pasted-into cell to the last cell are filled with the pasted string's
  leading characters, and any excess characters beyond the last cell are discarded

#### Scenario: Focus lands on the first empty cell after a partial paste
- **WHEN** a paste fills fewer than all four cells
- **THEN** keyboard focus moves to the first cell still empty after the paste
