import { defineConfig, devices } from "@playwright/test";

const PORT = 3300;

/** E2E 스모크: 실제 배포와 같은 프로덕션 빌드를 띄워 모든 페이지를 브라우저로 열고, 에러가 하나라도 나면 실패한다 (e2e/support.ts) */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    // 셸에 NODE_ENV=development가 있으면 프로덕션 빌드가 React를 섞어 prerender에서 터진다 — production으로 고정
    env: { NODE_ENV: "production" },
  },
});
