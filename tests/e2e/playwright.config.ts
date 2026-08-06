import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')

// When set (e.g. to a deployed Render URL), the suite targets that already-running deployment
// instead of the local dev loop - no local process to boot or reuse. See e2e-test-tooling's
// "target an already-running deployment" requirement. Unset (the default) preserves exactly
// today's local behavior.
const remoteBaseUrl = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  retries: 0,
  // An HTML report is only useful (and only ever collected) in CI - see e2e-production.yml, which
  // uploads tests/e2e/playwright-report/ on failure. Local runs stay console-only.
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: remoteBaseUrl ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  // Never hit :5106 directly (see CLAUDE.md) - the suite always drives the app through the Vite
  // port, exactly like the manual dev loop. Omitted entirely in remote mode: there is nothing local
  // to boot or reuse when the target is already running elsewhere.
  webServer: remoteBaseUrl
    ? undefined
    : [
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
