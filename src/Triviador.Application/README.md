# Triviador.Application

Use-case orchestration. Depends only on `Triviador.Domain`. Owns the room-actor orchestration
(`RoomActor`, `RoomRegistry`, `RoomFactory`, `ConnectionMap`), the port interfaces Infrastructure
implements (`IRoomBroadcaster`, `IRoomClock`, `IAnswerOracle`, `IQuestionRepository`,
`IMapRepository`), and the wire-facing DTOs a UI project projects engine state into.

Empty scaffold as of `openspec/changes/restructure-clean-architecture` — real content starts in M1.
See that change's `design.md` for the layer boundary rules.
