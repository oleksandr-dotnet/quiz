import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  // Never hit :5106 directly (see CLAUDE.md) - the suite always drives the app through the Vite
  // port, exactly like the manual dev loop.
  webServer: [
    {
      command: 'dotnet run --project src/UI/Triviador.Web/Triviador.Web.csproj',
      cwd: repoRoot,
      url: 'http://localhost:5106/api/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      cwd: path.join(repoRoot, 'src', 'Triviador.Client'),
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
