using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using Triviador.Application.Accounts;
using Triviador.Application.Content;
using Triviador.Application.Hosting;
using Triviador.Infrastructure.Accounts;
using Triviador.Infrastructure.Content;
using Triviador.Infrastructure.Hosting;
using Triviador.Web.Auth;
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

// --- Accounts (player-accounts): Postgres/EF Core + Google sign-in + JWT/refresh tokens ---
builder.Services.AddDbContext<TriviadorDbContext>(o =>
    o.UseNpgsql(NormalizePostgresConnectionString(builder.Configuration.GetConnectionString("Postgres"))));
builder.Services.Configure<GoogleAuthOptions>(builder.Configuration.GetSection("GoogleAuth"));
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.AddScoped<IUserAccountRepository, EfUserAccountRepository>();
builder.Services.AddScoped<IRefreshTokenStore, EfRefreshTokenStore>();
builder.Services.AddScoped<IGoogleIdTokenVerifier, GoogleIdTokenVerifier>();
builder.Services.AddSingleton<ITokenIssuer, JwtTokenIssuer>();
builder.Services.AddScoped<GoogleSignInService>();
builder.Services.AddScoped<AccountSetupService>();

var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
if (string.IsNullOrEmpty(jwtOptions.SigningKey))
{
    // Anonymous play must stay fully available even with zero accounts configuration (see
    // player-accounts's "Anonymous play remains fully available") - the app must still boot and
    // serve every anonymous-flow request. Production must always set a real key via secret/env
    // var so tokens survive a restart/multiple instances; failing loudly there instead of
    // silently generating a per-process key is the correct behavior for a real deployment.
    if (!builder.Environment.IsDevelopment())
    {
        throw new InvalidOperationException(
            "Jwt:SigningKey is not configured. Set it via an environment variable/secret manager before starting in a non-Development environment.");
    }
    jwtOptions.SigningKey = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
}
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        // Keep "sub"/"username"/"avatar" as written by JwtTokenIssuer instead of the legacy
        // ClaimTypes remap - GameHub/AuthEndpoints both read the raw "sub" claim.
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromSeconds(30),
        };
        o.Events = new JwtBearerEvents
        {
            // WebSockets can't set an Authorization header, so SignalR's accessTokenFactory sends
            // the token via the query string instead - accepted only on the hub's own path.
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(accessToken) &&
                    context.HttpContext.Request.Path.StartsWithSegments("/hub/game"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            },
        };
    });
builder.Services.AddAuthorization();

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
app.UseAuthentication();
app.UseAuthorization();
app.MapHub<GameHub>("/hub/game");
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapAuthEndpoints();
app.MapFallbackToFile("index.html");

app.Run();

// Hosting providers (Render, Neon, Heroku, ...) commonly hand out Postgres connection info as a
// postgres(ql):// URI, but Npgsql's NpgsqlConnectionStringBuilder only accepts ADO.NET-style
// Key=Value pairs and throws ArgumentException - with the *entire input string, password
// included* - if given a URI. That exception's Message then flows straight into Kestrel's
// unhandled-exception logging, leaking the password to logs. Converting the URI form up front
// means UseNpgsql never sees (and can never fail on, and can never leak) the raw URI.
static string? NormalizePostgresConnectionString(string? raw)
{
    if (string.IsNullOrWhiteSpace(raw))
        return raw;

    if (!raw.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
        !raw.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        return raw;

    var uri = new Uri(raw);
    var userInfo = uri.UserInfo.Split(':', 2);
    var queryParams = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(uri.Query);
    var sslMode = queryParams.TryGetValue("sslmode", out var sslModeValues) ? sslModeValues.ToString() : null;

    var builder = new NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.Port > 0 ? uri.Port : 5432,
        Username = Uri.UnescapeDataString(userInfo[0]),
        Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "",
        Database = uri.AbsolutePath.TrimStart('/'),
        SslMode = string.Equals(sslMode, "disable", StringComparison.OrdinalIgnoreCase)
            ? SslMode.Disable
            : SslMode.Require,
    };
    return builder.ConnectionString;
}
