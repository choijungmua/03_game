import { expect, test } from "./support";

test("지연된 한글 글꼴이 실제로 로드되고 정보 페이지가 가로로 넘치지 않는다", async ({ page }) => {
  await page.goto("/capybara");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Array.from(document.fonts).some((font) => font.family.replaceAll('"', "").replaceAll("'", "") === "Pretendard"))).toBe(true);
  const loaded = await page.evaluate(async () => {
    const faces = await document.fonts.load('400 16px "Pretendard"', "카피바라 ggpli");
    return { count: faces.length, ready: faces.every((font) => font.status === "loaded"), width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  expect(loaded.count).toBeGreaterThan(0);
  expect(loaded.ready).toBe(true);
  expect(loaded.scrollWidth).toBeLessThanOrEqual(loaded.width);
});

test("JavaScript 없이도 소개와 게임 목록의 본문·이동 링크를 읽을 수 있다", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 700 } });
  try {
    const page = await context.newPage();
    await page.goto("/capybara");
    await expect(page.getByRole("heading", { name: "카피바라는 어떤 동물일까요?" })).toBeVisible();
    await page.getByRole("link", { name: "카피바라 게임 목록", exact: true }).click();
    await expect(page.getByRole("heading", { name: "카피바라 게임 모음", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "카피바라 런", exact: true })).toHaveAttribute("href", "/games/capybara-run");
  } finally {
    await context.close();
  }
});
