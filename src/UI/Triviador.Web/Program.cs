using System.Text.Json.Serialization;
using Triviador.Application.Content;
using Triviador.Application.Hosting;
using Triviador.Infrastructure.Content;
using Triviador.Infrastructure.Hosting;
using Triviador.Web.Realtime;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddSignalR(o =>
    {
        o.EnableDetailedErrors = builder.Environment.IsDevelopment();
        o.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
        o.KeepAliveInterval = TimeSpan.FromSeconds(10);
    })
    .AddJsonProtocol(o =>
    {
        o.PayloadSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddSingleton(new RoomOptions());
builder.Services.AddSingleton<IRoomClock, SystemClock>();
builder.Services.AddSingleton<IRoomCodeGenerator, RoomCodeGenerator>();
builder.Services.AddSingleton<IRoomBroadcaster, SignalRRoomBroadcaster>();
builder.Services.AddSingleton<IRoomFactory, RoomFactory>();
builder.Services.AddSingleton<RoomRegistry>();
builder.Services.AddSingleton<ConnectionMap>();
builder.Services.AddSingleton<IMapRepository, MapRepository>();
builder.Services.AddHostedService<RoomJanitor>();

var app = builder.Build();

// Force construction now, not on first use - a bad Data/map.json should fail startup, not a player's
// first "Start Game" click.
app.Services.GetRequiredService<IMapRepository>();

if (app.Environment.IsDevelopment())
{
    app.Lifetime.ApplicationStarted.Register(() =>
        Console.WriteLine("\n  ➜  Dev mode: browse http://localhost:5173 (not this port) - Vite proxies API/hub calls here.\n"));
}

app.UseDefaultFiles();
app.UseStaticFiles();
app.MapHub<GameHub>("/hub/game");
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapFallbackToFile("index.html");

app.Run();
