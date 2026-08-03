namespace Triviador.Application.Accounts;

/// The only account shape anything outside `Accounts/` ever sees - never a raw entity, never a
/// token. `Username`/`AvatarId` are both null until the player completes first-login setup.
public sealed record AccountProfileDto(Guid UserId, string? Username, string? AvatarId)
{
    public bool IsSetupComplete => Username is not null && AvatarId is not null;
}
