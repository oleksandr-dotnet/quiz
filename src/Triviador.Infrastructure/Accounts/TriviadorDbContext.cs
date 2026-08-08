using Microsoft.EntityFrameworkCore;
using Triviador.Infrastructure.Accounts.Entities;
using Triviador.Infrastructure.Recaps.Entities;

namespace Triviador.Infrastructure.Accounts;

public sealed class TriviadorDbContext(DbContextOptions<TriviadorDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<GoogleIdentity> GoogleIdentities => Set<GoogleIdentity>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<GameRecap> GameRecaps => Set<GameRecap>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(b =>
        {
            b.HasKey(u => u.Id);
            b.Property(u => u.Username).HasMaxLength(20);
            b.Property(u => u.UsernameNorm).HasMaxLength(20);
            b.Property(u => u.AvatarId).HasMaxLength(32);
            // Filtered so multiple accounts can all sit at "no username yet" (null) without
            // colliding on the unique index - only a claimed username must be unique.
            b.HasIndex(u => u.UsernameNorm).IsUnique().HasFilter("\"UsernameNorm\" IS NOT NULL");
        });

        modelBuilder.Entity<GoogleIdentity>(b =>
        {
            b.HasKey(g => g.Id);
            b.Property(g => g.GoogleSubject).HasMaxLength(64).IsRequired();
            b.Property(g => g.Email).HasMaxLength(320).IsRequired();
            b.HasIndex(g => g.GoogleSubject).IsUnique();
            b.HasIndex(g => g.UserId).IsUnique();
            b.HasOne<User>().WithMany().HasForeignKey(g => g.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RefreshToken>(b =>
        {
            b.HasKey(r => r.Id);
            b.Property(r => r.TokenHash).IsRequired();
            b.HasIndex(r => r.TokenHash).IsUnique();
            b.HasIndex(r => r.FamilyId);
            b.HasOne<User>().WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GameRecap>(b =>
        {
            b.HasKey(r => r.Id);
            b.Property(r => r.Fingerprint).HasMaxLength(64).IsRequired();
            b.Property(r => r.RoomCode).HasMaxLength(16).IsRequired();
            b.Property(r => r.PayloadJson).HasColumnType("jsonb").IsRequired();
            b.HasIndex(r => r.Fingerprint).IsUnique();
            b.HasIndex(r => r.ExpiresAtUtc);
            // Deliberately no navigation/cascade to User - an anonymous share (SharedByUserId null)
            // must remain a valid, independently-retained row even if the sharer's account is later
            // deleted, unlike GoogleIdentity/RefreshToken which only ever exist alongside their User.
            b.HasOne<User>().WithMany().HasForeignKey(r => r.SharedByUserId).OnDelete(DeleteBehavior.SetNull);
        });
    }
}
