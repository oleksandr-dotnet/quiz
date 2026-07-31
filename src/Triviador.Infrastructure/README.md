# Triviador.Infrastructure

Concrete implementations of `Triviador.Application`'s ports: file-backed `QuestionRepository` /
`MapRepository` reading `Data/*.json`, the SignalR-backed `IRoomBroadcaster`, and hosting-runtime
concerns like `RoomJanitor` (a `BackgroundService`) and `RoomCodeGenerator`. Depends on `Application`
and transitively `Domain`.

Empty scaffold as of `openspec/changes/restructure-clean-architecture` — real content starts in M1.
See that change's `design.md` for the layer boundary rules.
