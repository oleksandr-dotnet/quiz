namespace Triviador.Domain.Primitives;

public enum RejectionCode
{
    GameAlreadyFinished,
    WrongPhase,
    UnknownPlayer,
    NotAwaitingThisInput,
    StaleActivityToken,
    NotYourTurn,
    AlreadyAnswered,
    DeadlineNotReached,
    NotEnoughPlayers,
    RoomFull,
    PlayerAlreadyJoined,
    UnknownRegion,
    RegionAlreadyOwned,
    BaseTooCloseToExistingBase,
    RegionNotEligible,
}
