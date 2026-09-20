import type { Page } from "@playwright/test";
import { LIST_ONLY_GAMES } from "@/lib/games/constants";
import { GAMES } from "@/lib/games/registry";
import {
  BUILDING_WIDTH,
  createWorld,
  LOBBY_SEED,
  PLAYER_BODY,
  playerBodyBlocked,
  TILE,
  WALK_SPEED,
  type WorldPoint,
} from "@/lib/lobby/world";
import { API_ORIGIN, expect, test } from "./support";

const WORLD = createWorld(
  LOBBY_SEED,
  GAMES.filter((game) => !LIST_ONLY_GAMES.includes(game.slug)).map(({ slug, title }) => ({ slug, title })),
);

async function loadAt(page: Page, point: WorldPoint): Promise<void> {
  if (!page.url().includes("lobby-geometry-test")) {
    await page.goto("/?lobby-geometry-test=1", { waitUntil: "domcontentloaded" });
  }
  const canvas = page.getByRole("img", { name: /카피바라 온천 습지 마을 로비/ });
  await expect(canvas).toHaveAttribute("data-player-x", /-?\d/, { timeout: 15_000 });
  await page.evaluate((position) => {
    document.dispatchEvent(new CustomEvent("lobby-geometry-test-position", { detail: position }));
  }, point);
  await expect(canvas).toHaveAttribute("data-player-x", String(point.x));
}

function shoreApproach(): WorldPoint {
  for (let ty = -70; ty <= 70; ty += 1) {
    for (let tx = -100; tx <= 100; tx += 1) {
      if (WORLD.tileAt(tx, ty) !== "water" || WORLD.blockedAt((tx - 0.5) * TILE, (ty + 0.5) * TILE)) continue;
      return { x: (tx - 0.5) * TILE, y: (ty + 0.5) * TILE };
    }
  }
  throw new Error("walkable fishing shore not found");
}

test("우클릭은 메뉴나 버튼 포커스 대신 로비 이동으로 처리된다", async ({ page }) => {
  await page.goto("/");

  const attack = page.getByRole("button", { name: "때리기 (F)" });
  await attack.click();
  await expect(attack).not.toBeFocused();

  const wardrobe = page.getByRole("button", { name: "내 카피바라 메뉴", exact: true });
  await wardrobe.click({ button: "right" });

  await expect(wardrobe).not.toBeFocused();
  await page.keyboard.press("Space");
  await expect(wardrobe).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.evaluate(() => {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).resolves.toBe(true);
});

test("같은 월드 접근점에서 문·의자·온천·사과·물가·방명록 상호작용이 열린다", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route(`${API_ORIGIN}/api/lobby/apples`, (route) =>
    route.fulfill({ json: { trees: WORLD.appleTrees.map(() => 3), lastCatch: "apple", caughtCount: 1, inventory: { apple: 1 } } }),
  );
  await page.route(`${API_ORIGIN}/api/lobby/fishing`, async (route) => {
    const body = route.request().postDataJSON();
    const active = typeof body === "object" && body !== null && Reflect.get(body, "command") === "start";
    await route.fulfill({
      json: {
        active,
        nextCatchAt: active ? new Date(Date.now() + 60_000).toISOString() : null,
        inventory: {},
        lastCatch: null,
        caughtCount: 0,
        consumed: false,
        feedStatus: null,
        satiety: 0,
        affection: 0,
        outfit: {},
      },
    });
  });

  const door = WORLD.doors[0];
  await loadAt(page, door);
  await expect(page.getByRole("status")).toContainText(door.title);

  const seat = WORLD.seats[0];
  await loadAt(page, { x: seat.seatX, y: seat.standY });
  await page.getByRole("button", { name: "통나무에 앉기" }).click();
  await expect(page.getByRole("button", { name: "일어나기" })).toBeVisible();
  await page.getByRole("button", { name: "일어나기" }).click();

  const spring = WORLD.springs[0];
  await loadAt(page, { x: spring.x, y: spring.y + TILE * 4.1 });
  await page.getByRole("button", { name: "온천에서 목욕하기" }).click();
  await expect(page.getByRole("button", { name: "온천에서 나오기" })).toBeVisible();
  await page.getByRole("button", { name: "온천에서 나오기" }).click();

  const apple = WORLD.appleTrees[0];
  await loadAt(page, { x: apple.x, y: apple.y + TILE * 1.5 });
  await page.getByRole("button", { name: "사과 따기" }).click();
  const appleProgress = page.getByRole("progressbar", { name: "사과 따는 중" });
  await expect(appleProgress).toBeVisible();
  await expect(appleProgress).toBeHidden({ timeout: 5_000 });

  await loadAt(page, WORLD.guestbook);
  await page.getByRole("button", { name: "방명록 보기" }).click();
  await expect(page.getByRole("button", { name: "방명록 보기" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("dialog", { name: "방명록" }).getByRole("button", { name: "닫기" }).click();

  await loadAt(page, shoreApproach());
  await page.getByRole("button", { name: /낚시하기/ }).click();
  await expect(page.getByRole("button", { name: "낚시 그만하기" })).toBeVisible();
});

test("발점·충돌 몸체 정렬과 건물 막힌 면을 CSS 뷰포트와 무관하게 유지한다", async ({ page }) => {
  const building = WORLD.buildings[0];
  const centerX = (building.tx + BUILDING_WIDTH / 2) * TILE;
  const start = { x: centerX - TILE * 2, y: building.frontY + TILE * 2 };
  await loadAt(page, start);

  const canvas = page.getByRole("img", { name: /카피바라 온천 습지 마을 로비/ });
  const footScreenY = Number(await canvas.getAttribute("data-foot-screen-y"));
  const bodyCenterY = footScreenY + (PLAYER_BODY.down - PLAYER_BODY.up) / 2;
  expect(Math.abs(footScreenY - bodyCenterY)).toBeLessThanOrEqual(4);
  await expect(page.getByRole("status")).toHaveText("");

  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(1_000);
  await page.keyboard.up("ArrowUp");

  const stoppedY = Number(await canvas.getAttribute("data-player-y"));
  expect(playerBodyBlocked(WORLD.blockedAt, { x: start.x, y: stoppedY })).toBe(false);
  expect(playerBodyBlocked(WORLD.blockedAt, { x: start.x, y: stoppedY - WALK_SPEED * 0.05 })).toBe(true);
  expect(stoppedY).toBeLessThan(start.y);
  await expect(page.getByRole("status")).toHaveText("");
});
