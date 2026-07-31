using System.Security.Cryptography;
using Triviador.Application.Hosting;

namespace Triviador.Infrastructure.Hosting;

/// No 0/1/I/O - they get misread when a room code is read aloud or dictated.
public sealed class RoomCodeGenerator : IRoomCodeGenerator
{
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const int Length = 4;

    public string NextCode()
    {
        var chars = new char[Length];
        for (var i = 0; i < Length; i++)
        {
            chars[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        }
        return new string(chars);
    }
}
