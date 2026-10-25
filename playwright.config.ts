import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run the real Next.js app and API routes, with:
 *  - Clerk + Supabase swapped for in-memory stand-ins (E2E=1, see next.config.js)
 *  - the AI provider pointed at a local fake server (tests/e2e/support/fake-ai-server.mjs)
 * CI builds and starts the production server; locally it uses `next dev`.
 */
const PORT = 3100;
const AI_PORT = 4555;
const isCI = !!process.env.CI;

const appEnv = {
    E2E: "1",
    GROQ_API_KEY: "gsk_e2e_fake_key_0000",
    GROQ_BASE_URL: `http://localhost:${AI_PORT}`,
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk",
    CLERK_SECRET_KEY: "sk_test_e2e",
    NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false,
    workers: 1, // the in-memory DB and fake AI are shared state
    retries: isCI ? 1 : 0,
    timeout: 120_000,
    expect: { timeout: 20_000 },
    reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
    use: {
        baseURL: `http://localhost:${PORT}`,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } },
        { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
    ],
    webServer: [
        {
            command: "node tests/e2e/support/fake-ai-server.mjs",
            url: `http://localhost:${AI_PORT}`,
            env: { FAKE_AI_PORT: String(AI_PORT) },
            reuseExistingServer: !isCI,
        },
        {
            command: isCI ? `npx next build && npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
            url: `http://localhost:${PORT}/api/health`,
            env: appEnv,
            timeout: 300_000,
            reuseExistingServer: !isCI,
        },
    ],
});
