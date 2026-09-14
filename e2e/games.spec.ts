import { GAME_TITLES } from "@/lib/games/constants";

import { expect, test } from "./support";

/** 방을 만들어 두는 온라인 대전 게임. 시작 화면이 방 목록이라 화면 가운데를 누르는 대신 컴터랑 두기를 펼쳐 본다 */
const ROOM_GAMES = new Set(["capybara-baduk", "capybara-gomoku", "capybara-alkkagi"]);
/** 한 번씩 눌러 보는 키 — 방향키로 움직이고 Space로 쏘거나 뛰는 게임들 */
const KEYS = ["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
/** 조작한 뒤 게임이 굴러가는 동안 에러가 나는지 지켜보는 시간 */
const WATCH_MS = 3000;

test("로비가 에러 없이 열린다", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ggpli/);
  await page.waitForTimeout(WATCH_MS);
});

for (const [slug, title] of Object.entries(GAME_TITLES)) {
  test(`${title} 페이지를 열고 조작해도 에러가 없다`, async ({ page }) => {
    await page.goto(`/games/${slug}`);
    await expect(page).toHaveTitle(/ggpli/);

    if (ROOM_GAMES.has(slug)) {
      await page.getByRole("button", { name: "컴터랑 두기" }).click();
      await expect(page.getByRole("group", { name: "컴퓨터 수준" })).toBeVisible();
      await expect(page.getByText("열린 방이 없어요")).toBeVisible();
    } else {
      const viewport = page.viewportSize() ?? { width: 800, height: 600 };
      await page.mouse.click(viewport.width / 2, viewport.height / 2);
      for (const key of KEYS) await page.keyboard.press(key);
    }

    await page.waitForTimeout(WATCH_MS);
  });
}
