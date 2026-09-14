import { expect, type Page, test as base } from "@playwright/test";

/** 프로덕션 빌드에 박힌 기본 API 주소 (lib/api-url.ts) */
export const API_ORIGIN = "http://localhost:4000";

/** 페이지에서 난 에러를 모은다: 잡히지 않은 예외 + console.error */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
  });
  return errors;
}

/**
 * 네트워크를 가짜로 받는다. CI에는 API 서버가 없고, 외부 광고 스크립트는 네트워크 사정에 따라 결과가 달라진다.
 * Playwright는 나중에 등록한 route가 먼저 잡으므로 넓은 규칙 → 좁은 규칙 순서로 등록하고, 테스트 본문에서 더 좁게 덮어쓸 수 있다
 */
async function stubNetwork(page: Page) {
  await page.route((url) => url.hostname !== "localhost", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route(`${API_ORIGIN}/**`, (route) => route.fulfill({ json: { ok: true } }));
  await page.route(`${API_ORIGIN}/api/games/*/rooms`, (route) =>
    route.request().method() === "GET" ? route.fulfill({ json: { ok: true, rooms: [] } }) : route.fallback(),
  );
  // 로비 WebSocket은 연결만 받아 두고 아무것도 보내지 않는다 (혼자 걷는 로비)
  await page.routeWebSocket(/\/api\/lobby\/ws/, () => {});
}

/** 모든 E2E 테스트에 자동으로 붙는다: 네트워크를 가짜로 받고, 테스트가 끝날 때 에러가 하나도 없어야 통과 */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors = collectErrors(page);
      await stubNetwork(page);
      await use(errors);
      expect(errors, "페이지에서 에러가 났어요").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
