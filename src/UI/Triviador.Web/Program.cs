using System.Text.Json.Serialization;
using Triviador.Application.Content;
using Triviador.Application.Hosting;
using Triviador.Infrastructure.Content;
using Triviador.Infrastructure.Hosting;
using Triviador.Web.Realtime;

// Containers (e.g. Render) can have a very low inotify instance/fd limit, which the default
// config-reload FileSystemWatcher on appsettings*.json can exhaust, crashing the process before
// it even starts. This must be set before CreateBuilder reads its bootstrap config, so it can't
// live in appsettings.json itself.
Environment.SetEnvironmentVariable("DOTNET_hostBuilder__reloadConfigOnChange", "false");

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
builder.Services.AddSingleton<IQuestionRepository, QuestionRepository>();
builder.Services.AddSingleton<IRandomSourceFactory, RandomSourceFactory>();
builder.Services.AddSingleton<IQuestionSourceFactory, QuestionSourceFactory>();
builder.Services.AddHostedService<RoomJanitor>();

var app = builder.Build();

// Force construction now, not on first use - bad Data/map.json or questions.json should fail
// startup, not a player's first "Start Game" click.
app.Services.GetRequiredService<IMapRepository>();
app.Services.GetRequiredService<IQuestionRepository>();

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
