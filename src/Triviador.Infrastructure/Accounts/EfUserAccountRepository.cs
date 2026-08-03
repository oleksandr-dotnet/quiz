using Microsoft.EntityFrameworkCore;
using Triviador.Application.Accounts;
using Triviador.Infrastructure.Accounts.Entities;

namespace Triviador.Infrastructure.Accounts;

public sealed class EfUserAccountRepository(TriviadorDbContext db) : IUserAccountRepository
{
    public async Task<AccountProfileDto?> FindByGoogleSubjectAsync(string googleSubject, CancellationToken ct = default)
    {
        var link = await db.GoogleIdentities
            .AsNoTracking()
            .FirstOrDefaultAsync(g => g.GoogleSubject == googleSubject, ct);
        if (link is null)
        {
            return null;
        }

        return await FindByIdAsync(link.UserId, ct);
    }

    public async Task<AccountProfileDto> CreateFromGoogleAsync(string googleSubject, string email, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var user = new User { Id = Guid.NewGuid(), CreatedAtUtc = now };
        db.Users.Add(user);
        db.GoogleIdentities.Add(new GoogleIdentity
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            GoogleSubject = googleSubject,
            Email = email,
            LinkedAtUtc = now,
        });
        await db.SaveChangesAsync(ct);

        return new AccountProfileDto(user.Id, user.Username, user.AvatarId);
    }

    public async Task<AccountProfileDto?> FindByIdAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        return user is null ? null : new AccountProfileDto(user.Id, user.Username, user.AvatarId);
    }

    public async Task<UsernameSetResult> TrySetUsernameAsync(Guid userId, string username, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            return UsernameSetResult.Invalid;
        }

        var norm = username.ToLowerInvariant();
        var taken = await db.Users.AsNoTracking().AnyAsync(u => u.UsernameNorm == norm && u.Id != userId, ct);
        if (taken)
        {
            return UsernameSetResult.Taken;
        }

        user.Username = username;
        user.UsernameNorm = norm;
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // The uniqueness check above is the fast path; this catch is the actual guard against
            // the race two concurrent claims can hit (design.md Decision 9) - the unique index on
            // UsernameNorm is what actually enforced it here.
            return UsernameSetResult.Taken;
        }

        return UsernameSetResult.Ok;
    }

    public async Task<AccountProfileDto> SetAvatarAsync(Guid userId, string avatarId, CancellationToken ct = default)
    {
        var user = await db.Users.FirstAsync(u => u.Id == userId, ct);
        user.AvatarId = avatarId;
        await db.SaveChangesAsync(ct);
        return new AccountProfileDto(user.Id, user.Username, user.AvatarId);
    }
}
