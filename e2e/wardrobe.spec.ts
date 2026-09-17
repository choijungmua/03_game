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

test("제거한 모자는 숨기고 남은 옷은 오류 없이 전환한다", async ({ page }) => {
  await page.route(`${API_ORIGIN}/api/lobby/fishing`, (route) => route.fulfill({ json: fishingState }));
  await page.goto("/");
  await page.getByRole("button", { name: "내 카피바라 메뉴", exact: true }).click();

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

test("저장 서버가 실패해도 고른 옷은 즉시 입힌다", async ({ page }) => {
  await page.route(`${API_ORIGIN}/api/lobby/fishing`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!DOCTYPE html><title>Not Found</title>" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "내 카피바라 메뉴", exact: true }).click();
  await page.getByRole("button", { name: "밀짚모자", exact: true }).click();

  await expect(page.getByRole("button", { name: "밀짚모자", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("탭 줄은 맨 아래에 그대로 있고 패널은 그 위 메뉴 폭 안에서만 보인다", async ({ page }) => {
  await page.route(`${API_ORIGIN}/api/lobby/fishing`, (route) => route.fulfill({ json: fishingState }));
  await page.goto("/");
  await page.getByRole("button", { name: "내 카피바라 메뉴", exact: true }).click();

  const menu = page.getByRole("dialog", { name: "내 카피바라" });
  const tablist = menu.getByRole("tablist");
  // 열리는 애니메이션(투명도·위치)이 끝난 뒤에 잰다
  await expect(menu).toHaveCSS("opacity", "1");
  await expect(menu).toHaveCSS("translate", "none");
  const menuBox = await menu.boundingBox();
  const tabWidth = (await tablist.boundingBox())?.width ?? 0;

  for (const name of ["카피바라 옷 입히기", "낚시 가방", "효과음 설정", "이름 바꾸기"]) {
    await menu.getByRole("tab", { name }).click();
    const panel = menu.getByRole("tabpanel", { name });
    await expect(panel).toBeVisible();
    await expect(menu.getByRole("tabpanel")).toHaveCount(1);
    const box = await panel.boundingBox();
    // 패널은 탭 줄 위에 있고 겹치지 않는다 (탭 줄은 메뉴 맨 아래라 메뉴 높이에 따라 같이 움직인다)
    const tabs = await tablist.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual((tabs?.y ?? 0) + 1);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((menuBox?.x ?? 0) + (menuBox?.width ?? 0) + 1);
    expect(tabs?.width).toBe(tabWidth);
    // 넘치는 내용은 패널 안에서만 스크롤되고 메뉴 자체는 넘치지 않는다
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
