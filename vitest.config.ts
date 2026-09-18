import path from "node:path";

import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // e2e/*.spec.ts는 브라우저 E2E(Playwright)라 vitest가 집어 가지 않게 뺀다.
    // .claude/worktrees 에는 다른 세션의 작업 사본이 쌓여 있어, 빼지 않으면 main에서 옛날 테스트까지 돌아 빨갛게 나온다
    exclude: [...configDefaults.exclude, "**/e2e/**", ".claude/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
