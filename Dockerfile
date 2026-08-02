# syntax=docker/dockerfile:1

# --- Stage 1: build the React client -----------------------------------------
FROM node:20-alpine AS client-build
WORKDIR /src
COPY src/Triviador.Client/package.json src/Triviador.Client/package-lock.json src/Triviador.Client/
RUN npm ci --prefix src/Triviador.Client
COPY src/Triviador.Client/ src/Triviador.Client/
# vite.config.ts writes to ../UI/Triviador.Web/wwwroot relative to the client project,
# so the output lands at /src/src/UI/Triviador.Web/wwwroot in this stage.
RUN npm run build --prefix src/Triviador.Client

# --- Stage 2: publish the .NET host ------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS server-build
WORKDIR /src
COPY Triviador.sln Directory.Build.props ./
COPY src/Triviador.Domain/Triviador.Domain.csproj src/Triviador.Domain/
COPY src/Triviador.Application/Triviador.Application.csproj src/Triviador.Application/
COPY src/Triviador.Infrastructure/Triviador.Infrastructure.csproj src/Triviador.Infrastructure/
COPY src/UI/Triviador.Web/Triviador.Web.csproj src/UI/Triviador.Web/
RUN dotnet restore src/UI/Triviador.Web/Triviador.Web.csproj
COPY src/Triviador.Domain/ src/Triviador.Domain/
COPY src/Triviador.Application/ src/Triviador.Application/
COPY src/Triviador.Infrastructure/ src/Triviador.Infrastructure/
COPY src/UI/Triviador.Web/ src/UI/Triviador.Web/
# Client is already built (stage 1) - skip the csproj's own npm-driven BuildClient target.
COPY --from=client-build /src/src/UI/Triviador.Web/wwwroot src/UI/Triviador.Web/wwwroot
RUN dotnet publish src/UI/Triviador.Web/Triviador.Web.csproj \
    -c Release -o /app/publish -p:SkipClientBuild=true --no-restore

# --- Stage 3: runtime ----------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=server-build /app/publish .
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 10000
# Render (and most free PaaS hosts) inject $PORT at runtime; default to 10000 for local `docker run`.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-10000} dotnet Triviador.Web.dll"]
