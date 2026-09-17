import { API_ORIGIN, expect, test } from "./support";

const fishingState = {
  active: false,
  nextCatchAt: null,
  inventory: {},
  lastCatch: null,
  caughtCount: 0,
  consumed: false,
  feedStatus: null,
  satiety: 0,
  affection: 0,
  satietyGain: 0,
  affectionGain: 0,
  outfit: {},
};

test("제거한 모자는 숨기고 남은 옷은 오류 없이 전환한다", async ({ page, isMobile }) => {
  await page.route(`${API_ORIGIN}/api/lobby/fishing`, (route) => route.fulfill({ json: fishingState }));
  await page.goto("/");
  await page.getByRole("button", { name: "내 카피바라 메뉴", exact: true }).click();
  await page.getByRole("button", { name: "카피바라 옷 입히기" }).click();

  for (const removed of ["수박 헬멧", "잎사귀 모자", "털실 비니"]) {
    await expect(page.getByRole("button", { name: new RegExp(removed) })).toHaveCount(0);
  }

  const catalog = {
    모자: ["없음", "황금 왕관 특별한 옷", "유자 온천 수건 특별한 옷", "밀짚모자"],
    안경: ["없음", "별 선글라스 특별한 옷", "무지개 파티 안경 특별한 옷", "물안경 특별한 옷", "나무테 안경", "선글라스", "하트 안경"],
    한벌옷: ["없음", "공룡 잠옷 특별한 옷", "상어 잠옷 특별한 옷", "딸기 옷 특별한 옷", "개구리 우비", "멜빵바지", "유카타"],
  } as const;
  for (const [tab, options] of Object.entries(catalog)) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    for (const option of options) {
      await page.getByRole("button", { name: option, exact: true }).click();
    }
  }

  await expect(page.getByRole("region", { name: "카피바라 옷 입히기" })).toBeVisible();
});

test("저장 서버가 실패해도 고른 옷은 즉시 입힌다", async ({ page, isMobile }) => {
  await page.route(`${API_ORIGIN}/api/lobby/fishing`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!DOCTYPE html><title>Not Found</title>" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "내 카피바라 메뉴", exact: true }).click();
  await page.getByRole("button", { name: "카피바라 옷 입히기" }).click();
  await page.getByRole("button", { name: "밀짚모자", exact: true }).click();

  await expect(page.getByRole("button", { name: "밀짚모자", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("우측 기능은 상단 탭을 유지하고 그 아래 한 영역에서 열린다", async ({ page, isMobile }) => {
  await page.route(`${API_ORIGIN}/api/lobby/fishing`, (route) => route.fulfill({ json: fishingState }));
  await page.goto("/");
  await page.getByRole("button", { name: "내 카피바라 메뉴", exact: true }).click();

  const menu = page.getByRole("dialog", { name: "내 카피바라" });
  const tabs = menu.getByRole("button", { name: /카피바라 옷 입히기|낚시 가방|효과음|이름 바꾸기/ });
  const tabBoxes = await tabs.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().bottom));
  const tabsBottom = Math.max(...tabBoxes);

  for (const { button, region } of [
    { button: "카피바라 옷 입히기", region: "카피바라 옷 입히기" },
    { button: /낚시 가방/, region: "낚시 가방" },
    { button: /효과음/, region: "효과음 설정" },
    { button: /이름 바꾸기/, region: "이름 바꾸기" },
  ]) {
    await page.getByRole("button", { name: button }).click();
    const panel = page.getByRole("region", { name: region });
    await expect(panel).toBeVisible();
    await expect(tabs).toHaveCount(4);
    await expect(page.getByRole("dialog")).toHaveCount(1);
      const box = await panel.boundingBox();
      expect(box?.y).toBeGreaterThanOrEqual(tabsBottom);
      await expect(page.getByRole("heading", { name: "내 카피바라" })).toBeVisible();
      const geometry = await menu.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));
      expect(geometry.scrollWidth).toBe(geometry.clientWidth);
      expect(geometry.scrollHeight).toBe(geometry.clientHeight);
  }
});

test("PC 우측 메뉴는 일정한 폭을 유지한다", async ({ page, isMobile }) => {
  test.skip(isMobile);
  await page.route(`${API_ORIGIN}/api/lobby/fishing`, (route) => route.fulfill({ json: fishingState }));
  await page.goto("/");
  await page.getByRole("button", { name: "내 카피바라 메뉴", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "내 카피바라" });
  const menuBox = await menu.boundingBox();

  for (const { button, region } of [
    { button: "카피바라 옷 입히기", region: "카피바라 옷 입히기" },
    { button: /낚시 가방/, region: "낚시 가방" },
    { button: /이름 바꾸기/, region: "이름 바꾸기" },
  ]) {
    await page.getByRole("button", { name: button }).click();
    const panel = page.getByRole("region", { name: region });
    const panelBox = await panel.boundingBox();
    expect(panelBox?.width).toBeLessThanOrEqual(menuBox?.width ?? 0);
  }
});
