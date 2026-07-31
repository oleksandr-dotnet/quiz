## 1. New projects

- [x] 1.1 Create `src/Triviador.Application` as an empty class library (no `.cs` files), referencing
      `src/Triviador.Domain`; add a one-line `README.md` explaining it's scaffolded ahead of M1.
- [x] 1.2 Create `src/Triviador.Infrastructure` as an empty class library, referencing
      `Triviador.Application` (and transitively `Domain`); add the same kind of `README.md`.
- [x] 1.3 Create `tests/Triviador.Application.Tests` and `tests/Triviador.Infrastructure.Tests` as
      empty xUnit + Shouldly projects, referencing their respective `src` project, matching the
      existing `Triviador.Domain.Tests` csproj shape (no duplicated `TargetFramework`/`Nullable`
      properties - inherited from `Directory.Build.props`).
- [x] 1.4 Add all four new projects to `Triviador.sln`.

## 2. Relocate the web host

- [x] 2.1 `git mv src/Triviador.Server src/UI/Triviador.Web`.
- [x] 2.2 `git mv tests/Triviador.Server.Tests tests/Triviador.Web.Tests`.
- [x] 2.3 Rename `Triviador.Server.csproj` -> `Triviador.Web.csproj` and
      `Triviador.Server.Tests.csproj` -> `Triviador.Web.Tests.csproj` (file rename, not just contents).
- [x] 2.4 Update `Triviador.sln` project entries: new paths, new project names/GUIDs as needed.
- [x] 2.5 In `Triviador.Web.csproj`: add `ProjectReference`s to `Triviador.Application` and
      `Triviador.Infrastructure`; fix the `BeforePublish` target's `WorkingDirectory` to
      `$(MSBuildProjectDirectory)\..\..\Triviador.Client`.
- [x] 2.6 In `Triviador.Web.Tests.csproj`: fix the `ProjectReference` path to
      `..\..\src\UI\Triviador.Web\Triviador.Web.csproj`.
- [x] 2.7 Rewrite `Triviador.Web/Triviador.Web.csproj`'s `InternalsVisibleTo`-style or namespace
      references if any assume the old `Triviador.Server` name (check `Program.cs`, `GameHub.cs` for
      `namespace Triviador.Server...` and rename to `Triviador.Web`).

## 3. Fix paths that reference the old location

- [x] 3.1 `src/Triviador.Client/vite.config.ts`: `build.outDir` ->
      `'../UI/Triviador.Web/wwwroot'`.
- [x] 3.2 Root `.gitignore`: `src/Triviador.Server/wwwroot/*` and its `!...gitkeep` line ->
      `src/UI/Triviador.Web/wwwroot/*` (and the matching `!` line).
- [x] 3.3 `README.md`: update the `dotnet watch --project` command path.
- [x] 3.4 `CLAUDE.md`: update every `src/Triviador.Server` path/command reference to
      `src/UI/Triviador.Web`.
- [x] 3.5 Update `C:\Users\OleksandrBondarenko\.claude\plans\we-will-create-triviador-cached-flask.md`:
      repo layout tree and every `Triviador.Server` reference -> `Triviador.Web` under `src/UI/`, and
      add a short note that `Triviador.Application`/`Triviador.Infrastructure` now exist per this
      change (M1's Hosting/Bots/Content code lands inside them, not inside Web, going forward).

## 4. Verify

- [x] 4.1 `dotnet build` from the repo root succeeds with zero errors.
- [x] 4.2 `dotnet test` runs (both pre-existing and the two new test projects report "no tests found" -
      expected, not a failure).
- [x] 4.3 Re-run the M0 manual round trip from the new paths: `dotnet watch --project
      src/UI/Triviador.Web/Triviador.Web.csproj run` in one terminal, `npm run dev` in
      `src/Triviador.Client` in another, browse `http://localhost:5173`, confirm the hub connects and
      "Ping the server" still returns "pong".
- [x] 4.4 `git status` shows the moved files as renames (not delete+add) for every relocated path.
